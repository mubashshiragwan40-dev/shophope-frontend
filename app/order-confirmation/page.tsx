// app/order-confirmation/page.tsx
"use client";

import { Suspense, useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { clearCart, readCart } from "@/lib/cart";
import { trackMetaEvent } from "@/components/meta-pixel";
import { LAST_COMPLETED_ORDER_KEY } from "@/app/checkout/page";
import CheckoutSteps from "@/components/checkout-steps";

interface StoredOrderSnapshot {
  orderNumber?: string;
  total?: number;
  numItems?: number;
  contentIds?: string[];
}

function CheckIcon(): ReactNode {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ConfirmationContent(): ReactNode {
  const searchParams = useSearchParams();
  const orderNumber: string = (searchParams.get("order") ?? "").trim();
  const trackedRef = useRef<string | null>(null);

  useEffect(() => {
    if (readCart().length > 0) {
      clearCart();
    }
  }, []);

  useEffect(() => {
    if (!orderNumber || trackedRef.current === orderNumber) return;
    trackedRef.current = orderNumber;

    let snapshot: StoredOrderSnapshot | null = null;
    try {
      const raw = sessionStorage.getItem(LAST_COMPLETED_ORDER_KEY);
      if (raw) {
        snapshot = JSON.parse(raw) as StoredOrderSnapshot;
      }
    } catch {
      // Ignore storage errors
    }

    const matchesSnapshot = snapshot?.orderNumber === orderNumber;
    trackMetaEvent("Purchase", {
      transaction_id: orderNumber,
      ...(matchesSnapshot && Array.isArray(snapshot?.contentIds)
        ? { content_ids: snapshot.contentIds, content_type: "product" }
        : {}),
      ...(matchesSnapshot && typeof snapshot?.total === "number"
        ? { value: Number(snapshot.total.toFixed(3)) }
        : {}),
      ...(matchesSnapshot && typeof snapshot?.numItems === "number"
        ? { num_items: snapshot.numItems }
        : {}),
      currency: "KWD",
    });
  }, [orderNumber]);

  return (
    <>
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
              Payment is Cash on Delivery. Please have the exact amount in KD ready when your order arrives.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/shop"
                className="h-12 px-8 inline-flex items-center justify-center bg-[#e91e63] hover:bg-[#c2185b] text-white text-[14px] font-semibold uppercase rounded-md transition-colors"
              >
                Continue shopping
              </Link>
              <Link
                href="/orders"
                className="h-12 px-8 inline-flex items-center justify-center border border-[#dee2e6] hover:border-[#e91e63] hover:text-[#e91e63] text-[14px] font-semibold uppercase rounded-md transition-colors"
              >
                Track order
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

export default function OrderConfirmationPage(): ReactNode {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" aria-busy="true" />}>
      <ConfirmationContent />
    </Suspense>
  );
}