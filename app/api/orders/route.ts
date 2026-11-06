// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { wcFetch, WooError } from "@/lib/woocommerce";
import { validateCheckoutCustomer } from "@/lib/checkout-validation";
import { graphqlRequest, ExpiredTokenError, GraphQLError } from "@/lib/graphql";
import {
  DELIVERY_FEE_KD,
  type CreateOrderResponse,
  type DeliveryMethod,
  type PaymentMethod,
} from "@/lib/orders";

/* ============================================================
   TYPES (WooCommerce REST responses, only the fields we use)
   ============================================================ */
interface WcProduct {
  id: number;
  name: string;
  status: string;
  type: string;
  purchasable: boolean;
  price: string;
  manage_stock: boolean;
  stock_status: string;
  stock_quantity: number | null;
  backorders_allowed: boolean;
}

interface WcCreatedOrder {
  id: number;
  number: string;
  status: string;
  total: string;
}

interface OrderLine {
  productId: number;
  quantity: number;
}

/* ============================================================
   CONSTANTS
   ============================================================ */
const MAX_LINES: number = 50;
const MIN_QUANTITY: number = 1;
const MAX_QUANTITY: number = 50;
const MAX_BODY_BYTES: number = 20_000;
const KUWAIT_COUNTRY: string = "KW";
const SESSION_EXPIRED_MESSAGE: string = "Your session has expired. Please log in again.";

const ALLOWED_DELIVERY: ReadonlyArray<DeliveryMethod> = ["standard"];
const ALLOWED_PAYMENT: ReadonlyArray<PaymentMethod> = ["cod"];

const VIEWER_ID_QUERY: string = /* GraphQL */ `
  query ViewerId {
    viewer {
      databaseId
    }
  }
`;

/* ============================================================
   HELPERS
   ============================================================ */

/** Plain error that carries the HTTP status and optional field errors back to the client. */
class RequestError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.name = "RequestError";
    this.status = status;
    this.fields = fields;
  }
}

function errorResponse(
  message: string,
  status: number,
  fields?: Record<string, string>
): NextResponse {
  return NextResponse.json(fields ? { error: message, fields } : { error: message }, { status });
}

/**
 * Reads "Authorization: Bearer <token>" and returns the WordPress user ID.
 * Returns null for guests (no header). Throws 401 for an invalid or expired token.
 */
async function getCustomerIdFromRequest(request: Request): Promise<number | null> {
  const header: string = (request.headers.get("Authorization") ?? "").trim();
  if (header === "") return null;

  const token: string = header.replace(/^Bearer\s+/i, "").trim();
  if (token === "") return null;

  try {
    const data = await graphqlRequest<{ viewer: { databaseId: number } | null }>(
      VIEWER_ID_QUERY,
      undefined,
      token
    );
    const id: unknown = data.viewer?.databaseId;
    if (typeof id === "number" && Number.isInteger(id) && id > 0) return id;
  } catch (err: unknown) {
    if (err instanceof ExpiredTokenError || err instanceof GraphQLError) {
      throw new RequestError(SESSION_EXPIRED_MESSAGE, 401);
    }
    throw err;
  }

  throw new RequestError(SESSION_EXPIRED_MESSAGE, 401);
}

/**
 * Cart IDs can be a WPGraphQL global ID (base64 of "post:42" / "product:42")
 * or a plain database ID. Both resolve to a positive integer.
 */
function toProductId(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isInteger(raw) && raw > 0) return raw;
  if (typeof raw !== "string") return null;

  const value: string = raw.trim();
  if (/^\d{1,12}$/.test(value)) return Number(value);

  try {
    const decoded: string = Buffer.from(value, "base64").toString("utf8");
    const match: RegExpMatchArray | null = decoded.match(/^[a-z_]+:(\d{1,12})$/i);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

/** Reads and checks the items list. Merges duplicate products and enforces quantity limits. */
function parseItems(raw: unknown): OrderLine[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new RequestError("Your cart is empty.", 400);
  }
  if (raw.length > MAX_LINES) {
    throw new RequestError("Too many items in one order.", 400);
  }

  const merged: Map<number, number> = new Map();

  for (const entry of raw) {
    const e = (typeof entry === "object" && entry !== null ? entry : {}) as {
      id?: unknown;
      quantity?: unknown;
    };
    const productId: number | null = toProductId(e.id);
    const quantity: unknown = e.quantity;

    if (
      productId === null ||
      typeof quantity !== "number" ||
      !Number.isInteger(quantity) ||
      quantity < MIN_QUANTITY ||
      quantity > MAX_QUANTITY
    ) {
      throw new RequestError("One of the items in your cart is invalid.", 400);
    }

    const total: number = (merged.get(productId) ?? 0) + quantity;
    if (total > MAX_QUANTITY) {
      throw new RequestError(`You can order at most ${MAX_QUANTITY} of one item.`, 400);
    }
    merged.set(productId, total);
  }

  return Array.from(merged, ([productId, quantity]) => ({ productId, quantity }));
}

/**
 * Loads each product from WooCommerce and checks it can be bought.
 * Prices always come from the store, never from the browser.
 */
async function loadProducts(lines: OrderLine[]): Promise<Map<number, WcProduct>> {
  const ids: string = lines.map((l) => l.productId).join(",");
  const products: WcProduct[] = await wcFetch<WcProduct[]>(
    `/products?include=${ids}&per_page=${lines.length}`
  );
  const byId: Map<number, WcProduct> = new Map(products.map((p) => [p.id, p]));

  for (const line of lines) {
    const product: WcProduct | undefined = byId.get(line.productId);

    if (!product || product.status !== "publish" || !product.purchasable) {
      throw new RequestError(
        "An item in your cart is no longer available. Please remove it and try again.",
        409
      );
    }
    if (product.type !== "simple") {
      throw new RequestError(
        `"${product.name}" needs options selected and cannot be ordered from the cart.`,
        409
      );
    }
    if (product.stock_status === "outofstock") {
      throw new RequestError(`"${product.name}" is out of stock.`, 409);
    }
    if (
      product.manage_stock &&
      !product.backorders_allowed &&
      product.stock_quantity !== null &&
      line.quantity > product.stock_quantity
    ) {
      throw new RequestError(
        `Only ${product.stock_quantity} of "${product.name}" left in stock.`,
        409
      );
    }
  }

  return byId;
}

/** Same key the client sends. Prevents a double click or retry from creating two orders. */
function readIdempotencyKey(request: Request): string | null {
  const key: string = (request.headers.get("Idempotency-Key") ?? "").trim();
  return /^[A-Za-z0-9_-]{8,100}$/.test(key) ? key : null;
}

/** Looks for an order already created with this key (the retry case). */
async function findExistingOrder(key: string): Promise<WcCreatedOrder | null> {
  const found: WcCreatedOrder[] = await wcFetch<WcCreatedOrder[]>(
    `/orders?search=${encodeURIComponent(key)}&per_page=5`
  ).catch(() => []);
  return found.length > 0 ? found[0] : null;
}

/* ============================================================
   POST /api/orders
   Body: { customer, items: [{ id, quantity }], delivery, payment }
   Headers: Authorization (optional, logged-in users), Idempotency-Key (optional)
   Creates a cash-on-delivery order. Totals come from the server only.
   ============================================================ */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    /* 1. Parse the body (size-limited, never throws) */
    const rawText: string = await request.text().catch(() => "");
    if (rawText.length === 0 || rawText.length > MAX_BODY_BYTES) {
      return errorResponse("Invalid request.", 400);
    }

    let body: unknown;
    try {
      body = JSON.parse(rawText);
    } catch {
      return errorResponse("Invalid request.", 400);
    }

    const b = (typeof body === "object" && body !== null ? body : {}) as {
      customer?: unknown;
      items?: unknown;
      delivery?: unknown;
      payment?: unknown;
    };

    /* 2. Validate delivery and payment */
    const delivery: DeliveryMethod = (b.delivery ?? "standard") as DeliveryMethod;
    const payment: PaymentMethod = (b.payment ?? "cod") as PaymentMethod;

    if (!ALLOWED_DELIVERY.includes(delivery)) {
      return errorResponse("This delivery method is not available.", 400);
    }
    if (!ALLOWED_PAYMENT.includes(payment)) {
      return errorResponse("This payment method is not available.", 400);
    }

    /* 3. Validate customer (shared with the client, so both sides agree) */
    const { data: customer, errors } = validateCheckoutCustomer(b.customer);
    if (!customer) {
      return errorResponse(
        "Please correct the highlighted fields.",
        400,
        errors as Record<string, string>
      );
    }

    /* 4. Identify the logged-in user (null for guests). Invalid token returns 401. */
    const customerId: number | null = await getCustomerIdFromRequest(request);

    /* 5. Validate items and check them against the store */
    const lines: OrderLine[] = parseItems(b.items);

    /* 6. Retry protection */
    const idempotencyKey: string | null = readIdempotencyKey(request);
    if (idempotencyKey) {
      const existing: WcCreatedOrder | null = await findExistingOrder(idempotencyKey);
      if (existing) {
        const reply = {
          orderNumber: existing.number,
          email: customer.email,
        } as CreateOrderResponse;
        return NextResponse.json(reply, { status: 200 });
      }
    }

    await loadProducts(lines);

    /* 7. Build and create the WooCommerce order */
    const address = {
      first_name: customer.firstName,
      last_name: customer.lastName,
      address_1: `Block ${customer.block}, Street ${customer.street}, Building ${customer.building}`,
      address_2: [
        customer.floor ? `Floor ${customer.floor}` : "",
        customer.apartment ? `Apartment ${customer.apartment}` : "",
      ]
        .filter(Boolean)
        .join(", "),
      city: customer.area,
      state: customer.governorate,
      postcode: "",
      country: KUWAIT_COUNTRY,
    };

    const created: WcCreatedOrder = await wcFetch<WcCreatedOrder>("/orders", {
      method: "POST",
      body: JSON.stringify({
        customer_id: customerId ?? 0, // 0 = guest, otherwise the order appears in My Account
        status: "processing",
        set_paid: false,
        payment_method: "cod",
        payment_method_title: "Cash on delivery",
        billing: { ...address, email: customer.email, phone: customer.phone },
        shipping: { ...address, phone: customer.phone },
        customer_note: customer.deliveryNote ?? "",
        line_items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity })),
        shipping_lines: [
          {
            method_id: "flat_rate",
            method_title: "Standard delivery",
            total: DELIVERY_FEE_KD.toFixed(3),
          },
        ],
        meta_data: idempotencyKey ? [{ key: "_idempotency_key", value: idempotencyKey }] : [],
      }),
    });

    const reply = {
      orderNumber: created.number,
      email: customer.email,
    } as CreateOrderResponse;

    return NextResponse.json(reply, { status: 201 });
  } catch (err: unknown) {
    /* Known problems with the request, the session, or the cart */
    if (err instanceof RequestError) {
      return errorResponse(err.message, err.status, err.fields);
    }

    /* WooCommerce rejected or failed. Details stay in the server log only. */
    if (err instanceof WooError) {
      if (err.status === 401 || err.status === 403) {
        console.error("[orders] WooCommerce auth rejected. Check WC_CONSUMER_KEY/SECRET (Read/Write).");
      }
      console.error("[orders] WooCommerce error:", err.status, err.message);
      return errorResponse(
        "We could not place your order right now. Please try again in a moment.",
        502
      );
    }

    if (err instanceof Error && err.name === "TimeoutError") {
      return errorResponse("The store is taking too long to respond. Please try again.", 504);
    }

    console.error("[orders] Unexpected error:", err);
    return errorResponse("Unable to place order.", 500);
  }
}

/* ============================================================
   Other methods
   Order lookup lives in /api/orders/track (needs order number + contact).
   Listing or editing orders here would expose customer data, so it is blocked.
   ============================================================ */
const METHOD_NOT_ALLOWED: NextResponse = NextResponse.json(
  { error: "Method not allowed." },
  { status: 405, headers: { Allow: "POST" } }
);

export function GET(): NextResponse {
  return METHOD_NOT_ALLOWED;
}
export function PUT(): NextResponse {
  return METHOD_NOT_ALLOWED;
}
export function PATCH(): NextResponse {
  return METHOD_NOT_ALLOWED;
}
export function DELETE(): NextResponse {
  return METHOD_NOT_ALLOWED;
}
