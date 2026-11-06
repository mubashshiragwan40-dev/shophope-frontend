// app/cart/page.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  CART_EVENT,
  clearCart,
  formatKD,
  getCartSubtotal,
  readCart,
  removeFromCart,
  updateCartQuantity,
  type CartItem,
} from "@/lib/cart";
import { DELIVERY_FEE_KD } from "@/lib/orders";
import CheckoutSteps from "@/components/checkout-steps";

/* ============================================================
   CONSTANTS
   ============================================================ */
const SHIPPING_LOCATION: string = "Kuwait";

/* ============================================================
   ICONS
   ============================================================ */
function TrashIcon(): ReactNode {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function CartEmptyIcon(): ReactNode {
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#e91e63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

/* ============================================================
   CART ROW
   ============================================================ */
function CartRow({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}): ReactNode {
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const showImage: boolean = Boolean(item.image) && !imgFailed;
  const lineTotal: number = item.price * item.quantity;

  return (
    <div className="grid grid-cols-[72px_1fr] md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_40px] gap-4 md:gap-6 items-center py-6 border-b border-[#f1f5f9]">
      {/* Product */}
      <div className="flex items-center gap-4 min-w-0">
        <Link
          href={`/product/${item.slug}`}
          className="block w-[72px] h-[72px] shrink-0 bg-[#f8f9fa] border border-[#f1f5f9] overflow-hidden"
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image ?? undefined}
              alt={item.name}
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg viewBox="0 0 200 150" className="max-h-[40px] w-auto" role="img" aria-label="Product image placeholder">
                <rect x="62" y="40" width="76" height="76" rx="14" fill="#ffffff" stroke="#212529" strokeWidth="5" />
                <rect x="76" y="22" width="48" height="20" rx="6" fill="#e91e63" />
                <circle cx="100" cy="80" r="16" fill="#fde4ec" />
              </svg>
            </div>
          )}
        </Link>
        <div className="min-w-0">
          <Link
            href={`/product/${item.slug}`}
            className="block text-[15px] font-medium text-[#212529] hover:text-[#e91e63] transition-colors line-clamp-2"
          >
            {item.name}
          </Link>
          {/* Mobile: unit price shown here */}
          <p className="md:hidden mt-1 text-[14px] text-[#6c757d]">{formatKD(item.price)}</p>
        </div>
      </div>

      {/* Price (desktop) */}
      <div className="hidden md:block text-[15px] text-[#212529]">{formatKD(item.price)}</div>

      {/* Quantity */}
      <div className="col-span-2 md:col-span-1 flex items-center">
        <div className="flex items-center h-[42px] border border-[#dee2e6] rounded-md w-fit">
          <button
            type="button"
            aria-label={`Decrease quantity of ${item.name}`}
            onClick={() => onQuantityChange(item.id, item.quantity - 1)}
            disabled={item.quantity <= 1}
            className="w-8 h-8 text-[16px] text-[#212529] hover:text-[#e91e63] disabled:opacity-40 disabled:hover:text-[#212529]"
          >
            −
          </button>
          <span className="w-8 text-center text-[13px] font-semibold" aria-live="polite">
            {item.quantity}
          </span>
          <button
            type="button"
            aria-label={`Increase quantity of ${item.name}`}
            onClick={() => onQuantityChange(item.id, item.quantity + 1)}
            className="w-8 h-8 text-[16px] text-[#212529] hover:text-[#e91e63]"
          >
            +
          </button>
        </div>
      </div>

      {/* Subtotal (desktop) */}
      <div className="hidden md:block text-[15px] font-bold text-[#e91e63] whitespace-nowrap">
        {formatKD(lineTotal)}
      </div>

      {/* Remove (desktop) */}
      <div className="hidden md:flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name} from cart`}
          className="text-[#6c757d] hover:text-[#e91e63] transition-colors"
        >
          <TrashIcon />
        </button>
      </div>

      {/* Mobile footer: line total and remove */}
      <div className="md:hidden col-span-2 flex items-center justify-between">
        <span className="text-[14px] font-bold text-[#e91e63]">{formatKD(lineTotal)}</span>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6c757d] hover:text-[#e91e63] transition-colors"
        >
          <TrashIcon />
          Remove
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   TOTALS ROW
   ============================================================ */
function TotalRow({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }): ReactNode {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-[#f1f5f9] last:border-b-0">
      <span className={strong ? "text-[16px] font-bold text-[#212529]" : "text-[14px] text-[#6c757d]"}>{label}</span>
      <span className={strong ? "text-[18px] font-bold text-[#e91e63] text-right" : "text-[14px] text-[#212529] text-right"}>
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   PAGE
   Header and footer come from app/layout.tsx (SiteHeader / SiteFooter).
   ============================================================ */
export default function CartPage(): ReactNode {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);

  /* Load the cart and keep it in sync across the app */
  useEffect(() => {
    const sync = (): void => setItems(readCart());
    sync();
    // Hydrate from localStorage after mount to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(true);
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* Same totals and delivery fee as the checkout page */
  const subtotal: number = useMemo(() => getCartSubtotal(items), [items]);
  const shipping: number = items.length > 0 ? DELIVERY_FEE_KD : 0;
  const total: number = subtotal + shipping;

  /* Shared cart functions enforce the 1 to 50 quantity limit and save the cart */
  const handleQuantityChange = (id: string, quantity: number): void => {
    updateCartQuantity(id, quantity);
  };

  const handleRemove = (id: string): void => {
    removeFromCart(id);
  };

  const handleClear = (): void => {
    clearCart();
  };

  return (
    <>
      {/* Steps */}
      <section className="bg-[#f8f9fa] border-b border-[#f1f5f9]">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-8">
          <CheckoutSteps current={0} />
        </div>
      </section>

      <section className="bg-white py-8 lg:py-12">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
          {/* Loading */}
          {!loaded && (
            <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
              <div className="space-y-4">
                <div className="h-24 bg-[#f8f9fa] animate-pulse" />
                <div className="h-24 bg-[#f8f9fa] animate-pulse" />
              </div>
              <div className="h-64 bg-[#f8f9fa] animate-pulse" />
            </div>
          )}

          {/* Empty */}
          {loaded && items.length === 0 && (
            <div className="max-w-xl mx-auto text-center py-16 border border-[#f1f5f9] bg-[#f8f9fa] px-6">
              <div className="flex justify-center mb-5">
                <CartEmptyIcon />
              </div>
              <h2 className="text-[20px] font-semibold">Your cart is empty</h2>
              <p className="mt-2 text-[14px] text-[#6c757d]">Looks like you haven&apos;t added anything yet.</p>
              <Link
                href="/shop"
                className="mt-6 inline-flex h-[48px] px-8 items-center justify-center bg-[#e91e63] hover:bg-[#c2185b] text-white text-[14px] font-semibold uppercase rounded-md transition-colors"
              >
                Continue shopping
              </Link>
            </div>
          )}

          {/* Cart */}
          {loaded && items.length > 0 && (
            <div className="grid gap-10 lg:grid-cols-[1fr_360px] items-start">
              {/* Items table */}
              <div>
                <div className="hidden md:grid grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_40px] gap-6 pb-3 border-b-2 border-[#212529] text-[13px] font-semibold uppercase tracking-wide text-[#6c757d]">
                  <span>Product</span>
                  <span>Price</span>
                  <span>Quantity</span>
                  <span>Subtotal</span>
                  <span />
                </div>

                <div>
                  {items.map((item) => (
                    <CartRow
                      key={item.id}
                      item={item}
                      onQuantityChange={handleQuantityChange}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <Link
                    href="/shop"
                    className="inline-flex h-[44px] px-6 items-center border border-[#dee2e6] rounded-md text-[14px] font-medium hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
                  >
                    ← Continue shopping
                  </Link>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[14px] font-medium text-[#6c757d] hover:text-[#e91e63] underline underline-offset-4 transition-colors"
                  >
                    Clear cart
                  </button>
                </div>
              </div>

              {/* Cart totals */}
              <aside className="lg:sticky lg:top-28 border border-[#f1f5f9] bg-[#f8f9fa] p-6">
                <h2 className="text-[16px] font-bold uppercase tracking-wide pb-4 border-b border-[#dee2e6]">
                  Cart Totals
                </h2>

                <div className="mt-2">
                  <TotalRow label="Subtotal" value={formatKD(subtotal)} />
                  <TotalRow
                    label="Delivery"
                    value={
                      <span className="block">
                        <span className="block font-medium">{formatKD(shipping)}</span>
                        <span className="block text-[13px] text-[#6c757d] mt-1">Delivery to {SHIPPING_LOCATION}</span>
                      </span>
                    }
                  />
                  <TotalRow label="Total" value={formatKD(total)} strong />
                </div>

                <Link
                  href="/checkout"
                  className="mt-6 flex h-[52px] w-full items-center justify-center bg-[#e91e63] hover:bg-[#c2185b] active:scale-[0.99] text-white text-[14px] font-semibold uppercase rounded-md transition-all"
                >
                  Proceed to checkout
                </Link>
                <p className="mt-3 text-center text-[12px] text-[#6c757d]">
                  Taxes and final charges are confirmed at checkout.
                </p>
              </aside>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
