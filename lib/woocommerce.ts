// lib/woocommerce.ts
import "server-only";
import { createHmac, randomBytes } from "node:crypto";

const TIMEOUT_MS = 10_000;

export class WooError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "WooError";
    this.status = status;
  }
}

interface WooConfig {
  base: URL;
  key: string;
  secret: string;
}

function getConfig(): WooConfig {
  const rawUrl: string | undefined = process.env.WOOCOMMERCE_URL;
  const key: string | undefined = process.env.WC_CONSUMER_KEY;
  const secret: string | undefined = process.env.WC_CONSUMER_SECRET;
  if (!rawUrl || !key || !secret) throw new WooError("WooCommerce is not configured.", 500);

  const base: URL = new URL(rawUrl);
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:") {
    throw new WooError("WOOCOMMERCE_URL must use https in production.", 500);
  }
  return { base, key, secret };
}

function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** OAuth 1.0a signing, needed by WooCommerce when the site is not on HTTPS (local development). */
function signOAuth(method: string, fullUrl: string, key: string, secret: string): string {
  const url: URL = new URL(fullUrl);
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    params[k] = v;
  });
  params.oauth_consumer_key = key;
  params.oauth_nonce = randomBytes(16).toString("hex");
  params.oauth_signature_method = "HMAC-SHA1";
  params.oauth_timestamp = String(Math.floor(Date.now() / 1000));

  const normalized: string = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join("&");
  const baseString: string = [method.toUpperCase(), rfc3986(`${url.origin}${url.pathname}`), rfc3986(normalized)].join("&");
  params.oauth_signature = createHmac("sha1", `${rfc3986(secret)}&`).update(baseString).digest("base64");

  const signed: URL = new URL(`${url.origin}${url.pathname}`);
  for (const [k, v] of Object.entries(params)) signed.searchParams.set(k, v);
  return signed.toString();
}

/** Calls the WooCommerce REST API (v3). `path` starts with "/", for example "/orders". */
export async function wcFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { base, key, secret } = getConfig();
  const method: string = (init.method ?? "GET").toUpperCase();
  const root: string = base.toString().replace(/\/$/, "");
  let url: string = `${root}/wp-json/wc/v3${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (base.protocol === "https:") {
    headers.Authorization = `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}`;
  } else {
    url = signOAuth(method, url, key, secret);
  }

  const res: Response = await fetch(url, {
    ...init,
    method,
    headers: { ...headers, ...(init.headers as Record<string, string> | undefined) },
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!res.ok) {
    let message: string = `WooCommerce responded with ${res.status}`;
    try {
      const body: unknown = await res.json();
      if (typeof body === "object" && body !== null && "message" in body) {
        message = String((body as { message: unknown }).message);
      }
    } catch {
      /* keep the default message */
    }
    throw new WooError(message, res.status);
  }
  return (await res.json()) as T;
}
