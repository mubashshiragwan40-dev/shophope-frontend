// app/api/orders/track/route.ts
import { NextResponse } from "next/server";
import { wcFetch, WooError } from "@/lib/woocommerce";
import {
  STATUS_LABELS,
  TIMELINE_STEPS,
  type OrderStatus,
  type TimelineStep,
  type TrackedItem,
  type TrackedOrder,
} from "@/lib/orders";

/* ============================================================
   TYPES (WooCommerce REST responses, only the fields we use)
   ============================================================ */
interface WcMeta {
  key: string;
  value: unknown;
}

interface WcLineItem {
  name: string;
  quantity: number;
  total: string;
}

interface WcShipmentTracking {
  tracking_provider?: string;
  custom_tracking_provider?: string;
  tracking_number?: string;
  custom_tracking_link?: string;
  tracking_link?: string;
}

interface WcOrderFull {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  currency: string;
  shipping_total: string;
  billing: { email: string; phone: string };
  line_items: WcLineItem[];
  meta_data: WcMeta[];
}

/* ============================================================
   CONSTANTS
   ============================================================ */
const ORDER_NUMBER_RE: RegExp = /^\d{1,12}$/;
const MAX_CONTACT_LENGTH: number = 120;
const NOT_FOUND_MESSAGE: string =
  "We could not find an order with those details. Please check the order number and the email or mobile number you used at checkout.";

const KNOWN_STATUSES: ReadonlyArray<OrderStatus> = [
  "pending",
  "processing",
  "on-hold",
  "completed",
  "cancelled",
  "refunded",
  "failed",
];

const TRACKING_NUMBER_KEYS: ReadonlyArray<string> = ["_tracking_number", "tracking_number"];
const CARRIER_KEYS: ReadonlyArray<string> = ["_tracking_provider", "_carrier", "carrier"];
const TRACKING_URL_KEYS: ReadonlyArray<string> = ["_tracking_url", "tracking_url", "_tracking_link"];

/* ============================================================
   HELPERS
   ============================================================ */

/** Phone numbers are compared by their last 8 digits (Kuwait mobile length). */
function phoneKey(value: string): string {
  const digits: string = value.replace(/\D/g, "");
  return digits.length >= 8 ? digits.slice(-8) : "";
}

/** True when the entered contact matches the billing email or the billing phone. */
function contactMatches(contact: string, billing: { email: string; phone: string }): boolean {
  const entered: string = contact.trim();

  if (entered.includes("@")) {
    return entered.toLowerCase() === (billing.email ?? "").trim().toLowerCase();
  }

  const enteredPhone: string = phoneKey(entered);
  if (enteredPhone === "") return false;
  return enteredPhone === phoneKey(billing.phone ?? "");
}

function metaString(meta: WcMeta[], keys: ReadonlyArray<string>): string | null {
  for (const key of keys) {
    const found: WcMeta | undefined = meta.find((m) => m.key === key);
    if (found && typeof found.value === "string" && found.value.trim() !== "") {
      return found.value.trim();
    }
  }
  return null;
}

function isHttpUrl(value: string | null): value is string {
  if (value === null) return false;
  try {
    const url: URL = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

/** Reads courier details from the WooCommerce Shipment Tracking plugin, or from plain order meta. */
function extractTracking(order: WcOrderFull): {
  trackingNumber: string | null;
  carrier: string | null;
  trackingUrl: string | null;
} {
  const pluginEntry: WcShipmentTracking | undefined = order.meta_data
    .filter((m) => m.key === "_wc_shipment_tracking_items")
    .map((m) => (Array.isArray(m.value) ? (m.value[0] as WcShipmentTracking | undefined) : undefined))
    .find((v) => v !== undefined);

  if (pluginEntry && pluginEntry.tracking_number) {
    const link: string | null = pluginEntry.custom_tracking_link ?? pluginEntry.tracking_link ?? null;
    return {
      trackingNumber: pluginEntry.tracking_number,
      carrier: pluginEntry.custom_tracking_provider || pluginEntry.tracking_provider || null,
      trackingUrl: isHttpUrl(link) ? link : null,
    };
  }

  const url: string | null = metaString(order.meta_data, TRACKING_URL_KEYS);
  return {
    trackingNumber: metaString(order.meta_data, TRACKING_NUMBER_KEYS),
    carrier: metaString(order.meta_data, CARRIER_KEYS),
    trackingUrl: isHttpUrl(url) ? url : null,
  };
}

function toStatus(raw: string): OrderStatus {
  return (KNOWN_STATUSES as ReadonlyArray<string>).includes(raw) ? (raw as OrderStatus) : "processing";
}

/** Builds the 3-step timeline. "pending" and "on-hold" count as the first step. */
function buildTimeline(status: OrderStatus): TimelineStep[] {
  const rank: Record<string, number> = { pending: 0, "on-hold": 0, processing: 1, completed: 2 };
  const currentIndex: number = rank[status] ?? 1;

  return TIMELINE_STEPS.map((step, index): TimelineStep => ({
    key: step.key,
    label: step.label,
    done: index < currentIndex || (status === "completed" && index === currentIndex),
    current: index === currentIndex && status !== "completed",
  }));
}

function toTrackedOrder(order: WcOrderFull): TrackedOrder {
  const status: OrderStatus = toStatus(order.status);
  const items: TrackedItem[] = order.line_items.map((line) => ({
    name: line.name,
    quantity: line.quantity,
    total: line.total,
  }));
  const tracking = extractTracking(order);

  return {
    orderNumber: order.number,
    status,
    statusLabel: STATUS_LABELS[status],
    dateCreated: order.date_created,
    total: order.total,
    currency: order.currency,
    shippingTotal: order.shipping_total,
    items,
    trackingNumber: tracking.trackingNumber,
    carrier: tracking.carrier,
    trackingUrl: tracking.trackingUrl,
    timeline: buildTimeline(status),
  };
}

/* ============================================================
   POST /api/orders/track
   Body: { orderNumber: string, contact: string }
   Wrong contact and unknown order return the same 404, so order numbers cannot be guessed.
   ============================================================ */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => null);
    const b = (typeof body === "object" && body !== null ? body : {}) as {
      orderNumber?: unknown;
      contact?: unknown;
    };

    const orderNumber: string =
      typeof b.orderNumber === "string" ? b.orderNumber.trim().replace(/^#/, "") : "";
    const contact: string = typeof b.contact === "string" ? b.contact.trim() : "";

    if (!ORDER_NUMBER_RE.test(orderNumber) || contact.length < 5 || contact.length > MAX_CONTACT_LENGTH) {
      return NextResponse.json({ error: "Please enter a valid order number and contact." }, { status: 400 });
    }

    let order: WcOrderFull;
    try {
      order = await wcFetch<WcOrderFull>(`/orders/${orderNumber}`);
    } catch (err: unknown) {
      if (err instanceof WooError && err.status === 404) {
        return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
      }
      throw err;
    }

    if (!contactMatches(contact, order.billing)) {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 });
    }

    return NextResponse.json(toTrackedOrder(order), { status: 200 });
  } catch (err: unknown) {
    if (err instanceof WooError) {
      if (err.status === 401 || err.status === 403) {
        console.error("[track] WooCommerce auth rejected. Check WC_CONSUMER_KEY/SECRET and key permissions.");
      }
      console.error("[track] WooCommerce error:", err.status, err.message);
      return NextResponse.json(
        { error: "We could not look up your order right now. Please try again in a moment." },
        { status: 502 }
      );
    }
    console.error("[track] Unexpected error:", err);
    return NextResponse.json({ error: "Unable to track order." }, { status: 500 });
  }
}
