"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CART_EVENT,
  type CartItem,
  clearCart,
  formatKD,
  getCartCount,
  getCartSubtotal,
  readCart,
} from "@/lib/cart";
import CheckoutSteps from "@/components/checkout-steps";

/* ============================================================
   CONSTANTS
   ============================================================ */
const LOGO_SRC: string = "/logo.png";

/* ============================================================
   ICONS
   ============================================================ */
function BasketIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* ============================================================
   HEADER
   ============================================================ */
function Header({ cartCount, cartTotal }: { cartCount: number; cartTotal: number }) {
  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-[#f1f5f9]">
      <div className="w-full h-[90px] px-4 lg:px-5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center shrink-0 h-full" aria-label="Shop & Hope home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="Shop & Hope" className="h-[72px] w-auto max-w-[200px] object-contain" />
        </Link>

        <nav className="hidden md:flex items-center gap-8 h-full" aria-label="Main navigation">
          <Link href="/" className="text-[16px] font-medium uppercase text-[#212529] hover:text-[#e91e63] transition-colors">
            HOME
          </Link>
          <Link href="/shop" className="text-[16px] font-medium uppercase text-[#212529] hover:text-[#e91e63] transition-colors">
            SHOP
          </Link>
          <Link href="/orders" className="text-[16px] font-medium uppercase text-[#212529] hover:text-[#e91e63] transition-colors">
            TRACK ORDER
          </Link>
        </nav>

        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/cart"
            aria-label={`Cart with ${cartCount} items`}
            className="relative flex items-center gap-2 text-[#212529] hover:text-[#e91e63] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] rounded"
          >
            <span className="relative">
              <BasketIcon />
              <span className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#e91e63] text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </span>
            <span className="hidden sm:inline text-[16px] font-medium">{formatKD(cartTotal)}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer() {
  return (
    <footer className="bg-[#212529] text-white">
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="Shop & Hope" className="h-[64px] w-auto max-w-[180px] object-contain bg-white p-1 rounded" />
          <p className="mt-3 text-sm text-white/60 leading-relaxed">
            Best Deal Here. Fashion, beauty, electronics and more for the whole family.
          </p>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4">Quick Link</h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li>
              <Link href="/refund-policy" className="hover:text-[#e91e63] transition-colors">
                Refund and Returns Policy
              </Link>
            </li>
            <li>
              <Link href="/privacy-policy" className="hover:text-[#e91e63] transition-colors">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/orders" className="hover:text-[#e91e63] transition-colors">
                Orders Tracking
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4">Social Media</h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li>
              <a href="#" className="hover:text-[#e91e63] transition-colors">Facebook</a>
            </li>
            <li>
              <a href="#" className="hover:text-[#e91e63] transition-colors">Instagram</a>
            </li>
            <li>
              <a href="#" className="hover:text-[#e91e63] transition-colors">TikTok</a>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4">Contact Info</h3>
          <ul className="space-y-2 text-sm text-white/70">
            <li>Mubarak Al-Kabeer, Kuwait</li>
            <li>
              Phone:{" "}
              <a href="tel:+96599429456" className="hover:text-[#e91e63] transition-colors">+96599429456</a>
            </li>
            <li>
              Mail:{" "}
              <a href="mailto:customercare@shophope.in" className="hover:text-[#e91e63] transition-colors">
                customercare@shophope.in
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-5 text-xs text-white/50">
          © 2025 Shop Hope – All rights reserved.
        </p>
      </div>
    </footer>
  );
}

/* ============================================================
   CONFIRMATION CONTENT (reads the query string)
   ============================================================ */
function ConfirmationContent() {
  const searchParams = useSearchParams();
  const orderNumber: string = (searchParams.get("order") ?? "").trim();

  const [cart, setCart] = useState<CartItem[]>([]);

  /* Keep the header cart badge in sync. If the cart was not cleared
     earlier in the flow, clear it here (safe to call when already empty). */
  useEffect(() => {
    const sync = (): void => setCart(readCart());
    if (readCart().length > 0) {
      clearCart();
    }
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const subtotal: number = useMemo(() => getCartSubtotal(cart), [cart]);
  const itemCount: number = useMemo(() => getCartCount(cart), [cart]);

  return (
    <div className="min-h-screen bg-white text-[#212529] antialiased">
      <Header cartCount={itemCount} cartTotal={subtotal} />

      <main>
        {/* Steps */}
        <section className="bg-[#f8f9fa] border-b border-[#f1f5f9]">
          <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-8">
            <CheckoutSteps current={2} />
          </div>
        </section>

        <section className="bg-white py-8 sm:py-10">
          <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
            <div className="max-w-xl mx-auto text-center py-12" aria-live="polite">
              <span className="mx-auto w-16 h-16 rounded-full bg-[#e8f5ee] text-[#198754] flex items-center justify-center">
                <CheckIcon />
              </span>
              <h1 className="mt-5 text-[24px] font-bold text-[#212529]">Thank you for your order</h1>

              {orderNumber ? (
                <p className="mt-2 text-[15px] text-[#6c757d]">
                  Your order number is{" "}
                  <span className="font-semibold text-[#212529] break-all">#{orderNumber}</span>.
                </p>
              ) : (
                <p className="mt-2 text-[15px] text-[#6c757d]">
                  Your order has been received. Your order number was not found in this link.
                </p>
              )}

              <p className="mt-2 text-[13px] text-[#6c757d]">
                Payment is cash on delivery. Please have the exact amount in KD ready when your order arrives.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/shop"
                  className="h-12 px-8 inline-flex items-center justify-center bg-[#e91e63] hover:bg-[#c2185b] text-white text-[14px] font-semibold uppercase rounded-md transition-colors"
                >
                  Continue shopping
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

/* ============================================================
   PAGE (Suspense boundary required for useSearchParams)
   ============================================================ */
export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" aria-busy="true" />}>
      <ConfirmationContent />
    </Suspense>
  );
}
