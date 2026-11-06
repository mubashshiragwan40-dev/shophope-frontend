// app/wishlist/page.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { addToCart } from "@/lib/cart";
import { WISHLIST_EVENT, readWishlist, writeWishlist, type WishlistItem } from "@/lib/wishlist";

/* ============================================================
   CONSTANTS
   ============================================================ */
const CURRENCY: string = "د.ك";

/* ============================================================
   HELPERS
   ============================================================ */
function formatPrice(amount: number): string {
  return `${CURRENCY} ${amount.toFixed(2)}`;
}

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

function EmptyHeartIcon(): ReactNode {
  return (
    <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#e91e63" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

/* ============================================================
   WISHLIST ROW
   ============================================================ */
function WishlistRow({
  item,
  onAddToCart,
  onRemove,
}: {
  item: WishlistItem;
  onAddToCart: (item: WishlistItem) => void;
  onRemove: (id: string) => void;
}): ReactNode {
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const showImage: boolean = Boolean(item.image) && !imgFailed;

  return (
    <div className="grid grid-cols-[72px_1fr] md:grid-cols-[minmax(0,2fr)_1fr_200px_40px] gap-4 md:gap-6 items-center py-6 border-b border-[#f1f5f9]">
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
          {/* Mobile: price shown here */}
          <p className="md:hidden mt-1 text-[14px] font-bold text-[#e91e63]">{formatPrice(item.price)}</p>
        </div>
      </div>

      {/* Price (desktop) */}
      <div className="hidden md:block text-[15px] font-bold text-[#e91e63]">{formatPrice(item.price)}</div>

      {/* Actions */}
      <div className="col-span-2 md:col-span-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onAddToCart(item)}
          className="flex-1 md:flex-none h-[42px] px-5 bg-[#e91e63] hover:bg-[#c2185b] active:scale-[0.98] text-white text-[13px] font-semibold uppercase rounded-md transition-all"
        >
          Add to cart
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          className="md:hidden inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6c757d] hover:text-[#e91e63] transition-colors"
        >
          <TrashIcon />
          Remove
        </button>
      </div>

      {/* Remove (desktop) */}
      <div className="hidden md:flex justify-end">
        <button
          type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name} from wishlist`}
          className="text-[#6c757d] hover:text-[#e91e63] transition-colors"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   PAGE
   Header and footer come from app/layout.tsx (SiteHeader / SiteFooter).
   ============================================================ */
export default function WishlistPage(): ReactNode {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  /* Load wishlist and keep it in sync */
  useEffect(() => {
    const sync = (): void => setItems(readWishlist());
    sync();
    // Hydrate from localStorage after mount to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(true);
    window.addEventListener(WISHLIST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* Toast auto-hide */
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* Adds to the shared cart. The header updates itself via CART_EVENT. */
  const handleAddToCart = (item: WishlistItem): void => {
    addToCart({ id: item.id, slug: item.slug, name: item.name, image: item.image, price: item.price }, 1);
    setToast(`Added to cart: ${item.name}`);
  };

  const handleRemove = (id: string): void => {
    writeWishlist(readWishlist().filter((i) => i.id !== id));
  };

  const handleClear = (): void => {
    writeWishlist([]);
  };

  return (
    <>
      {/* Breadcrumb / title */}
      <section className="bg-[#f8f9fa] border-b border-[#f1f5f9]">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-6">
          <nav aria-label="Breadcrumb" className="text-sm text-[#6c757d]">
            <Link href="/" className="hover:text-[#e91e63] transition-colors">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-[#212529]">Wishlist</span>
          </nav>
          <h1 className="mt-2 text-[28px] sm:text-[32px] font-semibold leading-tight">Wishlist</h1>
        </div>
      </section>

      <section className="bg-white py-8 lg:py-12">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
          {/* Loading */}
          {!loaded && (
            <div className="space-y-4">
              <div className="h-24 bg-[#f8f9fa] animate-pulse" />
              <div className="h-24 bg-[#f8f9fa] animate-pulse" />
            </div>
          )}

          {/* Empty */}
          {loaded && items.length === 0 && (
            <div className="max-w-xl mx-auto text-center py-16 border border-[#f1f5f9] bg-[#f8f9fa] px-6">
              <div className="flex justify-center mb-5">
                <EmptyHeartIcon />
              </div>
              <h2 className="text-[20px] font-semibold">This wishlist is empty</h2>
              <p className="mt-2 text-[14px] text-[#6c757d]">
                You don&apos;t have any products in the wishlist yet. You will find a lot of interesting products on our
                Shop page.
              </p>
              <Link
                href="/shop"
                className="mt-6 inline-flex h-[48px] px-8 items-center justify-center bg-[#e91e63] hover:bg-[#c2185b] text-white text-[14px] font-semibold uppercase rounded-md transition-colors"
              >
                Return to shop
              </Link>
            </div>
          )}

          {/* List */}
          {loaded && items.length > 0 && (
            <div>
              <div className="hidden md:grid grid-cols-[minmax(0,2fr)_1fr_200px_40px] gap-6 pb-3 border-b-2 border-[#212529] text-[13px] font-semibold uppercase tracking-wide text-[#6c757d]">
                <span>Product</span>
                <span>Price</span>
                <span>Action</span>
                <span />
              </div>

              <div>
                {items.map((item) => (
                  <WishlistRow key={item.id} item={item} onAddToCart={handleAddToCart} onRemove={handleRemove} />
                ))}
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <Link
                  href="/shop"
                  className="inline-flex h-[44px] px-6 items-center border border-[#dee2e6] rounded-md text-[14px] font-medium hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
                >
                  ← Return to shop
                </Link>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[14px] font-medium text-[#6c757d] hover:text-[#e91e63] underline underline-offset-4 transition-colors"
                >
                  Clear wishlist
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Toast */}
      <div
        aria-live="polite"
        className={`fixed bottom-6 right-6 z-[60] max-w-[280px] bg-[#212529] text-white text-sm font-medium px-5 py-3 rounded-lg shadow-xl flex items-center gap-2 transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0 pointer-events-none"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#e91e63] shrink-0" />
        <span className="line-clamp-1">{toast ?? ""}</span>
      </div>
    </>
  );
}
