// app/checkout/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import {
  CART_EVENT,
  type CartItem,
  clearCart,
  formatKD,
  getCartCount,
  getCartSubtotal,
  readCart,
  removeFromCart,
  updateCartQuantity,
} from "@/lib/cart";
import {
  DELIVERY_FEE_KD,
  KUWAIT_GOVERNORATES,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type DeliveryMethod,
  type PaymentMethod,
} from "@/lib/orders";
import { EMAIL_RE, normalizeKuwaitPhone } from "@/lib/checkout-validation";
import { getStoredToken } from "@/lib/auth";
import CheckoutSteps from "@/components/checkout-steps";

/* ============================================================
   TYPES
   ============================================================ */
interface CheckoutForm {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  governorate: string;
  area: string;
  block: string;
  street: string;
  building: string;
  floor: string;
  apartment: string;
  deliveryNote: string;
  payment: PaymentMethod;
}

type FormErrors = Partial<Record<keyof CheckoutForm, string>>;

interface PaymentOption {
  value: PaymentMethod;
  title: string;
  description: string;
}

/** Error that keeps the field-level messages sent by the server. */
class OrderError extends Error {
  fields?: FormErrors;
  constructor(message: string, fields?: FormErrors) {
    super(message);
    this.name = "OrderError";
    this.fields = fields;
  }
}

/* ============================================================
   CONSTANTS (Kuwait specific)
   ============================================================ */

/* Only COD until a payment gateway (K-Net / card) is connected on the server. */
const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    value: "cod",
    title: "Cash on delivery",
    description: "Pay in cash (KD) when your order arrives",
  },
];

const EMPTY_FORM: CheckoutForm = {
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  governorate: "",
  area: "",
  block: "",
  street: "",
  building: "",
  floor: "",
  apartment: "",
  deliveryNote: "",
  payment: "cod",
};

const KUWAIT_MOBILE_RE: RegExp = /^[569]\d{7}$/;

/* ============================================================
   HELPERS
   ============================================================ */

function isKuwaitMobile(value: string): boolean {
  return KUWAIT_MOBILE_RE.test(normalizeKuwaitPhone(value.trim()));
}

function validate(form: CheckoutForm): FormErrors {
  const errors: FormErrors = {};
  if (!EMAIL_RE.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";
  if (!isKuwaitMobile(form.phone)) {
    errors.phone = "Enter an 8-digit Kuwait mobile number (starts with 5, 6 or 9).";
  }
  if (!form.governorate) errors.governorate = "Select your governorate.";
  if (!form.area.trim()) errors.area = "Area is required.";
  if (!form.block.trim()) errors.block = "Block is required.";
  if (!form.street.trim()) errors.street = "Street is required.";
  if (!form.building.trim()) errors.building = "House or building number is required.";
  return errors;
}

/**
 * Sends the order to the server route. The server re-reads every product price,
 * sets the delivery fee, and creates the WooCommerce order.
 * Browser totals are never trusted.
 *
 * When the customer is logged in, the auth token is sent so the server links the
 * order to their account (it then appears in My Account > Orders).
 * Without a token the order is saved as a guest order.
 */
async function placeOrder(form: CheckoutForm, items: CartItem[]): Promise<CreateOrderResponse> {
  const delivery: DeliveryMethod = "standard";

  const body: CreateOrderRequest = {
    customer: {
      email: form.email.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      governorate: form.governorate,
      area: form.area.trim(),
      block: form.block.trim(),
      street: form.street.trim(),
      building: form.building.trim(),
      floor: form.floor.trim(),
      apartment: form.apartment.trim(),
      deliveryNote: form.deliveryNote.trim(),
    },
    items: items.map((i) => ({ id: i.id, quantity: i.quantity })),
    delivery,
    payment: form.payment,
  };

  const token: string | null = getStoredToken();

  const res = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const data: unknown = await res.json().catch(() => null);

  if (!res.ok) {
    const payload = (typeof data === "object" && data !== null ? data : {}) as {
      error?: unknown;
      fields?: unknown;
    };
    const message: string =
      typeof payload.error === "string" ? payload.error : "Unable to place order.";
    const fields: FormErrors | undefined =
      typeof payload.fields === "object" && payload.fields !== null
        ? (payload.fields as FormErrors)
        : undefined;
    throw new OrderError(message, fields);
  }

  return data as CreateOrderResponse;
}

/* ============================================================
   ICONS
   ============================================================ */
function LockIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function CheckIcon({ size = 28 }: { size?: number }): ReactNode {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

/* ============================================================
   FORM FIELDS
   ============================================================ */
function inputClass(hasError: boolean): string {
  return `w-full h-12 px-4 bg-white border rounded-md text-[15px] text-[#212529] placeholder:text-[#adb5bd] focus:outline-none focus:ring-2 focus:ring-[#e91e63]/20 focus:border-[#e91e63] ${
    hasError ? "border-[#dc3545]" : "border-[#dee2e6]"
  }`;
}

function FieldLabel({
  htmlFor,
  optional = false,
  children,
}: {
  htmlFor: string;
  optional?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <label htmlFor={htmlFor} className="block mb-2 text-[13px] font-semibold text-[#212529]">
      {children}
      {optional ? (
        <span className="ml-1 font-normal text-[#6c757d]">(optional)</span>
      ) : (
        <span className="ml-0.5 text-[#dc3545]">*</span>
      )}
    </label>
  );
}

function FieldError({ id, message }: { id: string; message?: string }): ReactNode {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-[12px] text-[#dc3545]">
      {message}
    </p>
  );
}

interface TextFieldProps {
  name: keyof CheckoutForm;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "numeric" | "tel" | "email" | "decimal";
  optional?: boolean;
  className?: string;
}

function TextField({
  name,
  label,
  value,
  error,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  inputMode,
  optional = false,
  className = "",
}: TextFieldProps): ReactNode {
  const errorId: string = `${name}-error`;
  return (
    <div className={className}>
      <FieldLabel htmlFor={name} optional={optional}>
        {label}
      </FieldLabel>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass(Boolean(error))}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function GovernorateField({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}): ReactNode {
  const errorId: string = "governorate-error";
  return (
    <div>
      <FieldLabel htmlFor="governorate">Governorate</FieldLabel>
      <select
        id="governorate"
        name="governorate"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass(Boolean(error))} appearance-none bg-no-repeat bg-[length:16px] bg-[right_16px_center] pr-10`}
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23495057' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
        }}
      >
        <option value="">Select</option>
        {KUWAIT_GOVERNORATES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function SectionCard({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="bg-white border border-[#f1f5f9] rounded-lg p-5 sm:p-6">
      <h2 className="flex items-center gap-3 text-[16px] font-bold text-[#212529] mb-5">
        <span className="w-7 h-7 rounded-full bg-[#e91e63] text-white text-[13px] font-bold flex items-center justify-center">
          {step}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function OptionCard({
  name,
  checked,
  onSelect,
  title,
  description,
}: {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  description: string;
}): ReactNode {
  return (
    <label
      className={`flex items-start gap-3 p-4 border rounded-md cursor-pointer transition-colors ${
        checked ? "border-[#e91e63] bg-[#fff5f8]" : "border-[#dee2e6] hover:border-[#e91e63]"
      }`}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="mt-1 accent-[#e91e63]"
      />
      <span>
        <span className="block text-[15px] font-semibold text-[#212529]">{title}</span>
        <span className="block mt-0.5 text-[13px] text-[#6c757d]">{description}</span>
      </span>
    </label>
  );
}

/* ============================================================
   ORDER SUMMARY
   ============================================================ */
function OrderSummary({
  items,
  subtotal,
  itemCount,
  deliveryFee,
  total,
  onQuantityChange,
  onRemove,
}: {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  deliveryFee: number;
  total: number;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}): ReactNode {
  return (
    <aside className="lg:sticky lg:top-28 bg-[#f8f9fa] border border-[#f1f5f9] rounded-lg p-5 sm:p-6">
      <h2 className="text-[16px] font-bold uppercase tracking-wide pb-4 border-b border-[#dee2e6]">
        Order summary
      </h2>

      <ul className="divide-y divide-[#e9ecef]">
        {items.map((item) => (
          <li key={item.id} className="flex gap-3 py-4">
            <div className="w-16 h-16 shrink-0 bg-white border border-[#f1f5f9] rounded overflow-hidden">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[#212529] line-clamp-2">{item.name}</p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="flex items-center h-8 border border-[#dee2e6] rounded-md bg-white">
                  <button
                    type="button"
                    aria-label={`Decrease quantity of ${item.name}`}
                    onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    className="w-7 h-7 text-[15px] hover:text-[#e91e63] disabled:opacity-40"
                  >
                    −
                  </button>
                  <span className="w-7 text-center text-[13px] font-semibold" aria-live="polite">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`Increase quantity of ${item.name}`}
                    onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                    className="w-7 h-7 text-[15px] hover:text-[#e91e63]"
                  >
                    +
                  </button>
                </div>
                <span className="text-[14px] font-semibold text-[#212529] whitespace-nowrap">
                  {formatKD(item.price * item.quantity)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="mt-2 text-[12px] text-[#6c757d] underline underline-offset-2 hover:text-[#e91e63]"
              >
                Remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-3 text-[14px]">
        <div className="flex justify-between">
          <dt className="text-[#6c757d]">Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</dt>
          <dd className="font-semibold text-[#212529]">{formatKD(subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#6c757d]">Delivery</dt>
          <dd className="font-semibold text-[#212529]">{formatKD(deliveryFee)}</dd>
        </div>
        <div className="flex justify-between items-baseline pt-4 border-t border-[#dee2e6]">
          <dt className="text-[16px] font-bold text-[#212529]">Total</dt>
          <dd className="text-[20px] font-bold text-[#e91e63]">{formatKD(total)}</dd>
        </div>
      </dl>

      <ul className="mt-5 space-y-2 text-[13px] text-[#6c757d]">
        <li className="flex items-center gap-2">
          <span className="text-[#198754]">
            <LockIcon />
          </span>
          Secure checkout
        </li>
        <li className="flex items-center gap-2">
          <span className="text-[#198754]">
            <CheckIcon size={16} />
          </span>
          Refund and returns policy applies
        </li>
      </ul>
    </aside>
  );
}

/* ============================================================
   PAGE
   Header and footer come from app/layout.tsx (SiteHeader / SiteFooter).
   ============================================================ */
export default function CheckoutPage(): ReactNode {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [orderEmail, setOrderEmail] = useState<string>("");

  /* Blocks a second submit even when two clicks arrive before React re-renders */
  const submittingRef = useRef<boolean>(false);

  /* Read the cart from localStorage and keep it in sync */
  useEffect(() => {
    const sync = (): void => setCart(readCart());
    sync();
    // Hydrate from localStorage after mount to avoid an SSR mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const subtotal: number = useMemo(() => getCartSubtotal(cart), [cart]);
  const itemCount: number = useMemo(() => getCartCount(cart), [cart]);

  /* Flat delivery fee. The server uses the same value from lib/orders.ts. */
  const deliveryFee: number = subtotal > 0 ? DELIVERY_FEE_KD : 0;
  const total: number = subtotal + deliveryFee;

  const updateField = <K extends keyof CheckoutForm>(key: K, value: CheckoutForm[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next: FormErrors = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (cart.length === 0 || submittingRef.current) return;

    const nextErrors: FormErrors = validate(form);
    setErrors(nextErrors);
    setSubmitError(null);

    const firstInvalid: string | undefined = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const order: CreateOrderResponse = await placeOrder(form, cart);

      /* Clear the cart only after the server confirms the order */
      clearCart();
      setOrderEmail(order.email);
      setOrderRef(order.orderNumber);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: unknown) {
      if (err instanceof OrderError) {
        setSubmitError(err.message);
        if (err.fields) {
          setErrors(err.fields);
          const firstServerField: string | undefined = Object.keys(err.fields)[0];
          if (firstServerField) document.getElementById(firstServerField)?.focus();
        }
      } else {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "Something went wrong while placing your order. Please try again."
        );
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const showEmpty: boolean = hydrated && cart.length === 0 && orderRef === null;
  const showSuccess: boolean = orderRef !== null;

  /* Step 2 (Checkout) while filling the form, step 3 (Order Complete) after success */
  const currentStep: number = showSuccess ? 2 : 1;

  return (
    <>
      {/* Page title and breadcrumb */}
      <section className="bg-[#f8f9fa] border-b border-[#f1f5f9]">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-8 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[#212529]">Checkout</h1>
          <nav aria-label="Breadcrumb" className="mt-3 text-sm text-[#6c757d]">
            <Link href="/" className="hover:text-[#e91e63] transition-colors">Home</Link>
            <span className="mx-2">/</span>
            <span className="text-[#212529]">Checkout</span>
          </nav>
        </div>
      </section>

      <section className="bg-white py-8 sm:py-10">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
          {/* Checkout progress indicator (shared component) */}
          <div className="mb-8">
            <CheckoutSteps current={currentStep} />
          </div>

          {!hydrated && (
            <div className="grid gap-8 lg:grid-cols-[1fr_380px]" aria-busy="true">
              <div className="h-[600px] bg-[#f8f9fa] animate-pulse" />
              <div className="h-[400px] bg-[#f8f9fa] animate-pulse" />
            </div>
          )}

          {showEmpty && (
            <div className="max-w-md mx-auto text-center py-16">
              <p className="text-[18px] font-bold text-[#212529]">Your cart is empty</p>
              <p className="mt-2 text-[14px] text-[#6c757d]">Add some products before checking out.</p>
              <Link
                href="/shop"
                className="mt-6 inline-flex h-12 px-8 items-center justify-center bg-[#e91e63] hover:bg-[#c2185b] text-white text-[14px] font-semibold uppercase rounded-md transition-colors"
              >
                Continue shopping
              </Link>
            </div>
          )}

          {showSuccess && (
            <div className="max-w-xl mx-auto text-center py-12" aria-live="polite">
              <span className="mx-auto w-16 h-16 rounded-full bg-[#e8f5ee] text-[#198754] flex items-center justify-center">
                <CheckIcon />
              </span>
              <h2 className="mt-5 text-[24px] font-bold text-[#212529]">Thank you for your order</h2>
              <p className="mt-2 text-[15px] text-[#6c757d]">
                Your order number is <span className="font-semibold text-[#212529]">#{orderRef}</span>. A confirmation
                will be sent to <span className="font-semibold text-[#212529]">{orderEmail}</span>.
              </p>
              <p className="mt-2 text-[13px] text-[#6c757d]">
                Use this number and your email or mobile number to track your order.
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
          )}

          {hydrated && cart.length > 0 && !showSuccess && (
            <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-start">
              {/* Left: checkout form */}
              <form id="checkout-form" onSubmit={handleSubmit} noValidate className="space-y-6">
                <SectionCard step={1} title="Contact information">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField
                      name="email"
                      label="Email address"
                      type="email"
                      value={form.email}
                      error={errors.email}
                      onChange={(v) => updateField("email", v)}
                      autoComplete="email"
                      inputMode="email"
                      placeholder="you@example.com"
                      className="sm:col-span-2"
                    />
                    <TextField
                      name="phone"
                      label="Mobile number"
                      type="tel"
                      value={form.phone}
                      error={errors.phone}
                      onChange={(v) => updateField("phone", v)}
                      autoComplete="tel-national"
                      inputMode="tel"
                      placeholder="5XXX XXXX"
                      className="sm:col-span-2"
                    />
                  </div>
                  <p className="mt-3 text-[12px] text-[#6c757d]">
                    Enter your 8-digit Kuwait mobile number. The +965 code is already included.
                  </p>
                </SectionCard>

                <SectionCard step={2} title="Delivery address">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <TextField
                      name="firstName"
                      label="First name"
                      value={form.firstName}
                      error={errors.firstName}
                      onChange={(v) => updateField("firstName", v)}
                      autoComplete="given-name"
                    />
                    <TextField
                      name="lastName"
                      label="Last name"
                      value={form.lastName}
                      error={errors.lastName}
                      onChange={(v) => updateField("lastName", v)}
                      autoComplete="family-name"
                    />

                    <GovernorateField
                      value={form.governorate}
                      error={errors.governorate}
                      onChange={(v) => updateField("governorate", v)}
                    />
                    <TextField
                      name="area"
                      label="Area"
                      placeholder="e.g. Salmiya"
                      value={form.area}
                      error={errors.area}
                      onChange={(v) => updateField("area", v)}
                    />

                    <TextField
                      name="block"
                      label="Block"
                      inputMode="numeric"
                      placeholder="e.g. 10"
                      value={form.block}
                      error={errors.block}
                      onChange={(v) => updateField("block", v)}
                    />
                    <TextField
                      name="street"
                      label="Street"
                      placeholder="e.g. Street 5"
                      value={form.street}
                      error={errors.street}
                      onChange={(v) => updateField("street", v)}
                    />

                    <TextField
                      name="building"
                      label="House or building number"
                      value={form.building}
                      error={errors.building}
                      onChange={(v) => updateField("building", v)}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <TextField
                        name="floor"
                        label="Floor"
                        optional
                        inputMode="numeric"
                        value={form.floor}
                        onChange={(v) => updateField("floor", v)}
                      />
                      <TextField
                        name="apartment"
                        label="Apartment"
                        optional
                        inputMode="numeric"
                        value={form.apartment}
                        onChange={(v) => updateField("apartment", v)}
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <FieldLabel htmlFor="deliveryNote" optional>
                        Delivery instructions
                      </FieldLabel>
                      <textarea
                        id="deliveryNote"
                        name="deliveryNote"
                        rows={3}
                        value={form.deliveryNote}
                        onChange={(e) => updateField("deliveryNote", e.target.value)}
                        placeholder="Landmark, gate color or other directions for the driver"
                        className="w-full px-4 py-3 bg-white border border-[#dee2e6] rounded-md text-[15px] placeholder:text-[#adb5bd] focus:outline-none focus:ring-2 focus:ring-[#e91e63]/20 focus:border-[#e91e63] resize-none"
                      />
                    </div>
                  </div>

                  <p className="mt-4 text-[13px] text-[#6c757d]">
                    Flat delivery fee: <span className="font-semibold text-[#212529]">{formatKD(DELIVERY_FEE_KD)}</span> on
                    every order.
                  </p>
                </SectionCard>

                <SectionCard step={3} title="Payment method">
                  <div className="space-y-3">
                    {PAYMENT_OPTIONS.map((option) => (
                      <OptionCard
                        key={option.value}
                        name="payment"
                        checked={form.payment === option.value}
                        onSelect={() => updateField("payment", option.value)}
                        title={option.title}
                        description={option.description}
                      />
                    ))}
                  </div>
                </SectionCard>

                {submitError && (
                  <div role="alert" className="border border-[#f5c2c7] bg-[#f8d7da] text-[#842029] text-[14px] p-4 rounded-md">
                    {submitError}
                  </div>
                )}

                <div className="bg-white border border-[#f1f5f9] rounded-lg p-5 sm:p-6">
                  <p className="text-[13px] text-[#6c757d] mb-4">
                    By placing your order you agree to our{" "}
                    <Link href="/refund-policy" className="text-[#e91e63] underline underline-offset-2">
                      Refund and Returns Policy
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy-policy" className="text-[#e91e63] underline underline-offset-2">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-14 bg-[#e91e63] hover:bg-[#c2185b] disabled:opacity-70 disabled:cursor-wait active:scale-[0.99] text-white text-[15px] font-bold uppercase tracking-wide rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] focus-visible:ring-offset-2"
                  >
                    {submitting ? "Placing order..." : `Place order · ${formatKD(total)}`}
                  </button>
                </div>
              </form>

              {/* Right: order summary */}
              <OrderSummary
                items={cart}
                subtotal={subtotal}
                itemCount={itemCount}
                deliveryFee={deliveryFee}
                total={total}
                onQuantityChange={(id, qty) => updateCartQuantity(id, qty)}
                onRemove={(id) => removeFromCart(id)}
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
