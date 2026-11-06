// app/orders/page.tsx
"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { formatKD } from "@/lib/cart";
import type { TimelineStep, TrackedOrder } from "@/lib/orders";

/* ============================================================
   CONSTANTS
   ============================================================ */
const TRACK_API: string = "/api/orders/track";
const CLOSED_STATUSES: ReadonlyArray<string> = ["cancelled", "refunded", "failed"];

/* ============================================================
   HELPERS
   ============================================================ */
function formatDate(value: string): string {
  const date: Date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusBadgeClass(status: string): string {
  if (status === "completed") return "bg-[#e8f5ee] text-[#198754]";
  if (CLOSED_STATUSES.includes(status)) return "bg-[#f8d7da] text-[#842029]";
  return "bg-[#fde4ec] text-[#e91e63]";
}

function inputClass(hasError: boolean): string {
  return `w-full h-12 px-4 bg-white border rounded-md text-[15px] text-[#212529] placeholder:text-[#adb5bd] focus:outline-none focus:ring-2 focus:ring-[#e91e63]/20 focus:border-[#e91e63] transition-colors ${
    hasError ? "border-[#dc3545]" : "border-[#dee2e6]"
  }`;
}

/* ============================================================
   ICONS
   ============================================================ */
function CheckIcon(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* ============================================================
   SUB COMPONENTS
   ============================================================ */
function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }): ReactNode {
  return (
    <label htmlFor={htmlFor} className="block text-[13px] font-semibold text-[#212529] mb-1.5">
      {children} <span className="text-[#e91e63]">*</span>
    </label>
  );
}

function Timeline({ steps }: { steps: TimelineStep[] }): ReactNode {
  return (
    <ol className="mt-6 space-y-5" aria-label="Order progress">
      {steps.map((step) => {
        const active: boolean = step.done || step.current;
        return (
          <li key={step.key} className="flex items-center gap-4">
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                active ? "bg-[#e91e63] text-white" : "bg-[#f1f5f9] text-[#adb5bd]"
              }`}
              aria-hidden="true"
            >
              {step.done ? <CheckIcon /> : step.current ? <span className="w-2 h-2 rounded-full bg-white" /> : null}
            </span>
            <span
              className={`text-[15px] ${
                step.current ? "font-bold text-[#e91e63]" : step.done ? "font-medium text-[#212529]" : "text-[#6c757d]"
              }`}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ============================================================
   PAGE
   Header and footer come from app/layout.tsx (SiteHeader / SiteFooter).
   ============================================================ */
export default function OrdersTrackingPage(): ReactNode {
  const [orderNumber, setOrderNumber] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [errors, setErrors] = useState<{ orderNumber?: string; contact?: string }>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<TrackedOrder | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (loading) return;

    const nextErrors: { orderNumber?: string; contact?: string } = {};
    if (!/^\d{1,12}$/.test(orderNumber.trim().replace(/^#/, ""))) {
      nextErrors.orderNumber = "Enter the order number from your confirmation (digits only).";
    }
    if (contact.trim().length < 5) {
      nextErrors.contact = "Enter the email or mobile number used at checkout.";
    }

    setErrors(nextErrors);
    setError(null);
    setOrder(null);

    if (Object.keys(nextErrors).length > 0) {
      const firstId: string = nextErrors.orderNumber ? "orderNumber" : "contact";
      document.getElementById(firstId)?.focus();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(TRACK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: orderNumber.trim(), contact: contact.trim() }),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const message: string =
          typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : "Something went wrong. Please try again.";
        throw new Error(message);
      }

      setOrder(data as TrackedOrder);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const subtotal: number = order ? Number(order.total) - Number(order.shippingTotal) : 0;

  return (
    <>
      {/* Title and breadcrumb */}
      <section className="bg-[#f8f9fa] border-b border-[#f1f5f9]">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Track your order</h1>
          <nav aria-label="Breadcrumb" className="mt-3 text-sm text-[#6c757d]">
            <Link href="/" className="hover:text-[#e91e63] transition-colors">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-[#212529]">Track order</span>
          </nav>
        </div>
      </section>

      <section className="bg-white py-10 sm:py-12">
        <div className="max-w-[640px] mx-auto px-4 sm:px-6">
          {/* Lookup form */}
          <form onSubmit={handleSubmit} noValidate className="bg-white border border-[#f1f5f9] rounded-lg p-5 sm:p-6 shadow-[0_2px_12px_rgba(33,37,41,0.04)] space-y-5">
            <p className="text-[14px] text-[#6c757d]">
              Enter your order number and the email or mobile number you used at checkout.
            </p>

            <div>
              <FieldLabel htmlFor="orderNumber">Order number</FieldLabel>
              <input
                id="orderNumber"
                name="orderNumber"
                inputMode="numeric"
                autoComplete="off"
                placeholder="e.g. 1042"
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value);
                  if (errors.orderNumber) setErrors((p) => ({ ...p, orderNumber: undefined }));
                }}
                aria-invalid={Boolean(errors.orderNumber)}
                aria-describedby={errors.orderNumber ? "orderNumber-error" : undefined}
                className={inputClass(Boolean(errors.orderNumber))}
              />
              {errors.orderNumber && (
                <p id="orderNumber-error" className="mt-1.5 text-[12px] text-[#dc3545]">{errors.orderNumber}</p>
              )}
            </div>

            <div>
              <FieldLabel htmlFor="contact">Email or mobile number</FieldLabel>
              <input
                id="contact"
                name="contact"
                autoComplete="off"
                placeholder="you@example.com or 5XXX XXXX"
                value={contact}
                onChange={(e) => {
                  setContact(e.target.value);
                  if (errors.contact) setErrors((p) => ({ ...p, contact: undefined }));
                }}
                aria-invalid={Boolean(errors.contact)}
                aria-describedby={errors.contact ? "contact-error" : undefined}
                className={inputClass(Boolean(errors.contact))}
              />
              {errors.contact && (
                <p id="contact-error" className="mt-1.5 text-[12px] text-[#dc3545]">{errors.contact}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-[52px] bg-[#e91e63] hover:bg-[#c2185b] disabled:opacity-70 disabled:cursor-wait text-white text-[14px] font-bold uppercase tracking-wide rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] focus-visible:ring-offset-2"
            >
              {loading ? "Checking..." : "Track order"}
            </button>
          </form>

          {error && (
            <div role="alert" className="mt-5 border border-[#f5c2c7] bg-[#f8d7da] text-[#842029] text-[14px] p-4 rounded-md">
              {error}
            </div>
          )}

          {/* Result */}
          {order && (
            <section className="mt-8 bg-white border border-[#f1f5f9] rounded-lg p-5 sm:p-6 shadow-[0_2px_12px_rgba(33,37,41,0.04)]" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[18px] font-bold">Order #{order.orderNumber}</h2>
                  <p className="mt-1 text-[13px] text-[#6c757d]">Placed on {formatDate(order.dateCreated)}</p>
                </div>
                <span className={`px-3 py-1 text-[12px] font-bold uppercase rounded-full ${statusBadgeClass(order.status)}`}>
                  {order.statusLabel}
                </span>
              </div>

              {!CLOSED_STATUSES.includes(order.status) && <Timeline steps={order.timeline} />}

              {order.trackingNumber && (
                <div className="mt-6 p-4 bg-[#f8f9fa] border border-[#f1f5f9] rounded-md text-[14px] space-y-1">
                  <p><span className="font-semibold">Courier:</span> {order.carrier ?? "Courier"}</p>
                  <p><span className="font-semibold">Tracking number:</span> {order.trackingNumber}</p>
                  {order.trackingUrl && (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-[#e91e63] underline underline-offset-2"
                    >
                      Track with courier
                    </a>
                  )}
                </div>
              )}

              <div className="mt-6 border-t border-[#e9ecef] pt-4">
                <h3 className="text-[14px] font-bold mb-2">Items</h3>
                <ul className="divide-y divide-[#e9ecef] text-[14px]">
                  {order.items.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="py-2.5 flex justify-between gap-4">
                      <span className="min-w-0">
                        {item.name} <span className="text-[#6c757d]">× {item.quantity}</span>
                      </span>
                      <span className="font-semibold whitespace-nowrap">{formatKD(Number(item.total))}</span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-4 space-y-2 text-[14px]">
                  <div className="flex justify-between">
                    <dt className="text-[#6c757d]">Subtotal</dt>
                    <dd className="font-semibold">{formatKD(subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#6c757d]">Delivery</dt>
                    <dd className="font-semibold">{formatKD(Number(order.shippingTotal))}</dd>
                  </div>
                  <div className="flex justify-between pt-3 border-t border-[#dee2e6]">
                    <dt className="font-bold">Total</dt>
                    <dd className="text-[18px] font-bold text-[#e91e63]">{formatKD(Number(order.total))}</dd>
                  </div>
                </dl>
              </div>

              <p className="mt-5 text-[12px] text-[#6c757d]">
                Payment: Cash on delivery. Please keep the exact amount ready when your order arrives.
              </p>
            </section>
          )}
        </div>
      </section>
    </>
  );
}
