// lib/cart.ts
import { DELIVERY_FEE_KD } from "@/lib/orders";

/* ============================================================
   CONSTANTS
   ============================================================ */
export const CART_STORAGE_KEY: string = "shophope-cart";

/** Dispatched on the window whenever the cart changes in this tab. */
export const CART_EVENT: string = "shophope-cart-change";

export const CURRENCY: string = "KD";

const MIN_QUANTITY: number = 1;
const MAX_QUANTITY: number = 50;

/* ============================================================
   TYPES
   ============================================================ */
export interface CartItem {
  /** WPGraphQL global ID or database ID. Sent to the server as-is. */
  id: string;
  slug: string;
  name: string;
  image: string | null;
  /** Unit price in KD, for display only. The server re-reads the real price. */
  price: number;
  quantity: number;
}

export type CartItemInput = Omit<CartItem, "quantity">;

/* ============================================================
   HELPERS
   ============================================================ */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return MIN_QUANTITY;
  return Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.floor(value)));
}

/** Guards against corrupted or old data in localStorage. */
function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<CartItem>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.slug === "string" &&
    typeof v.name === "string" &&
    (typeof v.image === "string" || v.image === null) &&
    typeof v.price === "number" &&
    Number.isFinite(v.price) &&
    typeof v.quantity === "number" &&
    Number.isInteger(v.quantity) &&
    v.quantity >= MIN_QUANTITY &&
    v.quantity <= MAX_QUANTITY
  );
}

/* ============================================================
   READ / WRITE
   ============================================================ */

/** Returns the cart from localStorage. Returns [] on the server or when data is invalid. */
export function readCart(): CartItem[] {
  if (!isBrowser()) return [];
  try {
    const raw: string | null = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isCartItem);
  } catch {
    return [];
  }
}

/** Saves the cart and notifies every component in this tab. */
export function writeCart(items: CartItem[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch {
    /* Storage full or disabled (private mode). Cart stays in memory for this page only. */
  }
  window.dispatchEvent(new Event(CART_EVENT));
}

/* ============================================================
   ACTIONS
   ============================================================ */

/** Adds a product. If it is already in the cart, the quantity is increased. */
export function addToCart(input: CartItemInput, quantity: number = 1): void {
  const items: CartItem[] = readCart();
  const addQty: number = clampQuantity(quantity);
  const existing: CartItem | undefined = items.find((i) => i.id === input.id);

  if (existing) {
    existing.quantity = clampQuantity(existing.quantity + addQty);
    existing.price = input.price;
    existing.name = input.name;
    existing.image = input.image;
    existing.slug = input.slug;
  } else {
    items.push({ ...input, quantity: clampQuantity(addQty) });
  }

  writeCart(items);
}

/** Sets an exact quantity (1 to 50). Values outside the range are clamped. */
export function updateCartQuantity(id: string, quantity: number): void {
  const items: CartItem[] = readCart().map((item) =>
    item.id === id ? { ...item, quantity: clampQuantity(quantity) } : item
  );
  writeCart(items);
}

export function removeFromCart(id: string): void {
  writeCart(readCart().filter((item) => item.id !== id));
}

export function clearCart(): void {
  writeCart([]);
}

/* ============================================================
   TOTALS
   ============================================================ */
export function getCartCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartSubtotal(items: CartItem[]): number {
  const total: number = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return Math.round(total * 1000) / 1000;
}

/** Flat delivery fee (KD 1.000). Same value is used by the checkout and the server. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getStandardShipping(_subtotal: number): number {
  return DELIVERY_FEE_KD;
}

/* ============================================================
   FORMATTING
   ============================================================ */

/** Kuwait prices use 3 decimals (fils). Example: KD 1.000 */
export function formatKD(amount: number): string {
  return `${CURRENCY} ${amount.toFixed(3)}`;
}
