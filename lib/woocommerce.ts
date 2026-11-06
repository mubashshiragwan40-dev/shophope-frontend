// lib/woocommerce.ts
// Server-side only. Never import this from a client component.
import OAuth from "oauth-1.0a";
import crypto from "crypto";

const WC_URL: string | undefined = process.env.WOOCOMMERCE_URL;
const WC_KEY: string | undefined = process.env.WC_CONSUMER_KEY;
const WC_SECRET: string | undefined = process.env.WC_CONSUMER_SECRET;

export class WooError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "WooError";
    this.status = status;
  }
}

// OAuth 1.0a signs each request. This is what WooCommerce expects over plain HTTP.
const oauth: OAuth | null =
  WC_KEY && WC_SECRET
    ? new OAuth({
        consumer: { key: WC_KEY, secret: WC_SECRET },
        signature_method: "HMAC-SHA256",
        hash_function(baseString: string, key: string): string {
          return crypto.createHmac("sha256", key).update(baseString).digest("base64");
        },
      })
    : null;

export async function wcFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!WC_URL || !oauth) {
    throw new WooError("WooCommerce environment variables are missing", 500);
  }

  const base: string = WC_URL.replace(/\/$/, "");
  const cleanPath: string = path.replace(/^\//, "");
  const url: string = `${base}/wp-json/wc/v3/${cleanPath}`;
  const method: string = (init.method ?? "GET").toUpperCase();

  // Sign the method and full URL (including any ?query). The JSON body is not part of the signature.
  const signed = oauth.toHeader(oauth.authorize({ url, method }));
  const authHeader: { Authorization: string } = { Authorization: signed.Authorization };

  const res: Response = await fetch(url, {
    ...init,
    method,
    cache: "no-store",
    signal: init.signal ?? AbortSignal.timeout(15_000),
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(init.headers ?? {}),
    },
  });

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const message: string =
      typeof data === "object" && data !== null && "message" in data
        ? String((data as { message: unknown }).message)
        : `WooCommerce request failed (${res.status})`;
    throw new WooError(message, res.status);
  }

  return data as T;
}
