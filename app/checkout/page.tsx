// app/checkout/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Script from "next/script";
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
  KUWAIT_AREAS_BY_GOVERNORATE,
  KUWAIT_GOVERNORATES,
  type CreateOrderRequest,
  type CreateOrderResponse,
  type DeliveryMethod,
  type PaymentMethod,
} from "@/lib/orders";
import { EMAIL_RE, normalizeKuwaitPhone } from "@/lib/checkout-validation";
import { EXPRESS_BUY_NOW_KEY } from "@/app/product/[slug]/product-client";
import { trackMetaEvent } from "@/components/meta-pixel";
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

interface CompletedOrderSnapshot {
  orderNumber: string;
  total: number;
  numItems: number;
  contentIds: string[];
}

interface GoogleJwtPayload {
  given_name?: string;
  family_name?: string;
  name?: string;
  email?: string;
}

interface GoogleCredentialResponse {
  credential?: string;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

class OrderError extends Error {
  fields?: FormErrors;
  constructor(message: string, fields?: FormErrors) {
    super(message);
    this.name = "OrderError";
    this.fields = fields;
  }
}

/* ============================================================
   CONSTANTS
   ============================================================ */
const SAVED_KW_ADDRESS_PREFIX = "shophope-kw-wa-addr-";
export const LAST_COMPLETED_ORDER_KEY = "shophope-last-order";
const OTHER_AREA_VALUE = "__OTHER__";
const GOOGLE_CLIENT_ID: string = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

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

function clearStaleAuthTokens(): void {
  if (typeof window === "undefined") return;
  try {
    const authKeyRegex = /(jwt|auth|token|session|bearer)/i;
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key && authKeyRegex.test(key) && !key.startsWith(SAVED_KW_ADDRESS_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const key = window.sessionStorage.key(i);
      if (
        key &&
        authKeyRegex.test(key) &&
        key !== EXPRESS_BUY_NOW_KEY &&
        key !== LAST_COMPLETED_ORDER_KEY
      ) {
        window.sessionStorage.removeItem(key);
      }
    }
    if (typeof document !== "undefined" && document.cookie) {
      for (const part of document.cookie.split(";")) {
        const eqIdx = part.indexOf("=");
        const name = (eqIdx > -1 ? part.slice(0, eqIdx) : part).trim();
        if (name && authKeyRegex.test(name)) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      }
    }
  } catch {
    // Ignore storage access errors
  }
}

function parseGoogleJwt(jwt: string): GoogleJwtPayload | null {
  try {
    const parts = jwt.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as GoogleJwtPayload;
  } catch {
    return null;
  }
}

function splitNameParts(fullName: string | undefined): { first: string; last: string } {
  const trimmed = (fullName ?? "").trim();
  if (!trimmed) return { first: "", last: "" };
  const pieces = trimmed.split(/\s+/);
  if (pieces.length === 1) return { first: pieces[0], last: "" };
  return { first: pieces[0], last: pieces.slice(1).join(" ") };
}

function validate(form: CheckoutForm): FormErrors {
  const errors: FormErrors = {};
  if (form.email.trim().length > 0 && !EMAIL_RE.test(form.email.trim())) {
    errors.email = "Enter a valid email address or leave it blank.";
  }
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

function newIdempotencyKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

async function placeOrder(
  form: CheckoutForm,
  items: CartItem[],
  idempotencyKey: string
): Promise<CreateOrderResponse> {
  clearStaleAuthTokens();
  const delivery: DeliveryMethod = "standard";

  const body: CreateOrderRequest = {
    customer: {
      email: form.email.trim() || undefined,
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

  const res = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
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

function GoogleIcon(): ReactNode {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.54-1.14 2.85-2.4 3.72v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.72Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
      />
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

function selectClass(hasError: boolean): string {
  return `${inputClass(hasError)} appearance-none bg-no-repeat bg-[length:16px] bg-[right_16px_center] pr-10`;
}

const SELECT_CHEVRON_STYLE = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23495057' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' viewBox='0 0 24 24'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
};

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
        autoComplete="address-level1"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass(Boolean(error))}
        style={SELECT_CHEVRON_STYLE}
      >
        <option value="">Select Governorate</option>
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

function AreaSelectField({
  governorate,
  value,
  customAreaMode,
  error,
  onSelectChange,
  onCustomAreaChange,
}: {
  governorate: string;
  value: string;
  customAreaMode: boolean;
  error?: string;
  onSelectChange: (selectedValue: string) => void;
  onCustomAreaChange: (customValue: string) => void;
}): ReactNode {
  const errorId: string = "area-error";
  const areas: readonly string[] = useMemo(
    () => (governorate ? KUWAIT_AREAS_BY_GOVERNORATE[governorate] ?? [] : []),
    [governorate]
  );

  const selectValue: string = customAreaMode
    ? OTHER_AREA_VALUE
    : areas.includes(value)
      ? value
      : areas[0] ?? "";

  return (
    <div>
      <FieldLabel htmlFor="area">Area</FieldLabel>
      <select
        id="area"
        name="areaSelect"
        value={selectValue}
        disabled={!governorate}
        autoComplete="address-level2"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onSelectChange(e.target.value)}
        className={`${selectClass(Boolean(error))} disabled:bg-[#f8f9fa] disabled:text-[#6c757d]`}
        style={SELECT_CHEVRON_STYLE}
      >
        {!governorate ? (
          <option value="">Select Governorate first</option>
        ) : (
          <>
            {areas.map((areaName) => (
              <option key={areaName} value={areaName}>
                {areaName}
              </option>
            ))}
            <option value={OTHER_AREA_VALUE}>Other (Type area manually)</option>
          </>
        )}
      </select>

      {customAreaMode && (
        <input
          type="text"
          id="area-custom"
          name="area"
          value={value}
          placeholder="Enter your area name"
          autoComplete="address-level2"
          aria-label="Custom area name"
          onChange={(e) => onCustomAreaChange(e.target.value)}
          className={`${inputClass(Boolean(error))} mt-2`}
        />
      )}

      <FieldError id={errorId} message={error} />
    </div>
  );
}

function SectionCard({
  step,
  title,
  badge,
  children,
}: {
  step: number;
  title: string;
  badge?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="bg-white border border-[#f1f5f9] rounded-lg p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
        <h2 className="flex items-center gap-3 text-[16px] font-bold text-[#212529]">
          <span className="w-7 h-7 rounded-full bg-[#e91e63] text-white text-[13px] font-bold flex items-center justify-center">
            {step}
          </span>
          {title}
        </h2>
        {badge && (
          <span className="rounded-full bg-[#fff5f8] px-3 py-1 text-[12px] font-semibold text-[#e91e63]">
            {badge}
          </span>
        )}
      </div>
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
  isBuyNowMode,
  onQuantityChange,
  onRemove,
}: {
  items: CartItem[];
  subtotal: number;
  itemCount: number;
  deliveryFee: number;
  total: number;
  isBuyNowMode: boolean;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
}): ReactNode {
  return (
    <aside className="lg:sticky lg:top-28 bg-[#f8f9fa] border border-[#f1f5f9] rounded-lg p-5 sm:p-6">
      <div className="flex items-center justify-between pb-4 border-b border-[#dee2e6]">
        <h2 className="text-[16px] font-bold uppercase tracking-wide">Order summary</h2>
        {isBuyNowMode && (
          <span className="rounded bg-[#e91e63] px-2 py-0.5 text-[11px] font-bold uppercase text-white">
            Buy Now
          </span>
        )}
      </div>

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
              {!isBuyNowMode && (
                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="mt-2 text-[12px] text-[#6c757d] underline underline-offset-2 hover:text-[#e91e63]"
                >
                  Remove
                </button>
              )}
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
          <dt className="text-[#6c757d]">Delivery (Kuwait)</dt>
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
          Secure WhatsApp-confirmed checkout
        </li>
        <li className="flex items-center gap-2">
          <span className="text-[#198754]">
            <CheckIcon size={16} />
          </span>
          Cash on Delivery across all Kuwait Governorates
        </li>
      </ul>
    </aside>
  );
}

/* ============================================================
   CHECKOUT CONTENT
   ============================================================ */
function CheckoutContent(): ReactNode {
  const searchParams = useSearchParams();
  const isBuyNowMode: boolean = searchParams.get("mode") === "buy_now";

  const [cart, setCart] = useState<CartItem[]>([]);
  const [expressItem, setExpressItem] = useState<CartItem | null>(null);
  const [hydrated, setHydrated] = useState<boolean>(false);
  const [form, setForm] = useState<CheckoutForm>(EMPTY_FORM);
  const [customAreaMode, setCustomAreaMode] = useState<boolean>(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [autofillNotice, setAutofillNotice] = useState<string | null>(null);
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);
  const [googleReady, setGoogleReady] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [orderPhone, setOrderPhone] = useState<string>("");

  const submittingRef = useRef<boolean>(false);
  const idempotencyKeyRef = useRef<string>("");
  const trackedPurchaseRef = useRef<string | null>(null);

  useEffect(() => {
    clearStaleAuthTokens();
    idempotencyKeyRef.current = newIdempotencyKey();
  }, []);

  useEffect(() => {
    const sync = (): void => setCart(readCart());
    sync();

    if (isBuyNowMode) {
      try {
        const rawExpress = sessionStorage.getItem(EXPRESS_BUY_NOW_KEY);
        if (rawExpress) {
          setExpressItem(JSON.parse(rawExpress) as CartItem);
        }
      } catch {
        // Fallback to regular cart
      }
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [isBuyNowMode]);

  useEffect(() => {
    const cleanDigits: string = normalizeKuwaitPhone(form.phone);
    if (!KUWAIT_MOBILE_RE.test(cleanDigits)) {
      setAutofillNotice(null);
      return;
    }

    try {
      const savedRaw = localStorage.getItem(`${SAVED_KW_ADDRESS_PREFIX}${cleanDigits}`);
      if (savedRaw) {
        const saved = JSON.parse(savedRaw) as Partial<CheckoutForm>;
        setForm((prev) => ({
          ...prev,
          firstName: prev.firstName || saved.firstName || "",
          lastName: prev.lastName || saved.lastName || "",
          email: prev.email || saved.email || "",
          governorate: prev.governorate || saved.governorate || "",
          area: prev.area || saved.area || "",
          block: prev.block || saved.block || "",
          street: prev.street || saved.street || "",
          building: prev.building || saved.building || "",
          floor: prev.floor || saved.floor || "",
          apartment: prev.apartment || saved.apartment || "",
        }));
        setAutofillNotice("Welcome back! Saved Kuwait address autofilled from your WhatsApp number.");
      }
    } catch {
      // Ignore storage errors
    }
  }, [form.phone]);

  const activeItems: CartItem[] = useMemo(() => {
    if (isBuyNowMode && expressItem) return [expressItem];
    return cart;
  }, [isBuyNowMode, expressItem, cart]);

  const subtotal: number = useMemo(() => getCartSubtotal(activeItems), [activeItems]);
  const itemCount: number = useMemo(() => getCartCount(activeItems), [activeItems]);
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

  const handleGoogleFill = (): void => {
    setSubmitError(null);
    if (!GOOGLE_CLIENT_ID) {
      setGoogleNotice(
        "1-Click Fill with Google is ready (add NEXT_PUBLIC_GOOGLE_CLIENT_ID to enable popup). You can also fill the guest form directly below."
      );
      return;
    }

    const gsi = window.google?.accounts?.id;
    if (!gsi || !googleReady) {
      setGoogleNotice("Loading Google one-tap helper... please try again in a second.");
      return;
    }

    gsi.initialize({
      client_id: GOOGLE_CLIENT_ID,
      auto_select: false,
      callback: (res) => {
        if (!res.credential) return;
        const payload = parseGoogleJwt(res.credential);
        if (!payload) return;
        const split = splitNameParts(payload.name);
        const first = (payload.given_name ?? split.first).trim();
        const last = (payload.family_name ?? split.last).trim();
        const email = (payload.email ?? "").trim();

        setForm((prev) => ({
          ...prev,
          firstName: first || prev.firstName,
          lastName: last || prev.lastName,
          email: email || prev.email,
        }));
        setErrors((prev) => {
          const next = { ...prev };
          if (first) delete next.firstName;
          if (last) delete next.lastName;
          if (email) delete next.email;
          return next;
        });
        setGoogleNotice(
          email
            ? `Auto-filled from Google (${email}). Enter your +965 WhatsApp & address below.`
            : "Auto-filled your name from Google. Enter your +965 WhatsApp & address below."
        );
      },
    });
    gsi.prompt();
  };

  const handleGovernorateChange = (newGov: string): void => {
    const govAreas = newGov ? KUWAIT_AREAS_BY_GOVERNORATE[newGov] ?? [] : [];
    const firstArea = govAreas[0] ?? "";
    setCustomAreaMode(false);
    setForm((prev) => ({
      ...prev,
      governorate: newGov,
      area: firstArea,
    }));
    setErrors((prev) => {
      const next: FormErrors = { ...prev };
      delete next.governorate;
      delete next.area;
      return next;
    });
  };

  const handleAreaSelectChange = (selectedVal: string): void => {
    if (selectedVal === OTHER_AREA_VALUE) {
      setCustomAreaMode(true);
      updateField("area", "");
      return;
    }
    setCustomAreaMode(false);
    updateField("area", selectedVal);
  };

  const handleQuantityChange = (id: string, qty: number): void => {
    if (isBuyNowMode && expressItem) {
      const clamped = Math.min(50, Math.max(1, qty));
      const updated = { ...expressItem, quantity: clamped };
      setExpressItem(updated);
      try {
        sessionStorage.setItem(EXPRESS_BUY_NOW_KEY, JSON.stringify(updated));
      } catch {
        // Ignore
      }
      return;
    }
    updateCartQuantity(id, qty);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (activeItems.length === 0 || submittingRef.current) return;

    const nextErrors: FormErrors = validate(form);
    setErrors(nextErrors);
    setSubmitError(null);

    const firstInvalid: string | undefined = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    const orderSnapshotTotal = Number(total.toFixed(3));
    const orderSnapshotItemsCount = itemCount;
    const orderSnapshotIds = activeItems.map((i) => i.id);

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const order: CreateOrderResponse = await placeOrder(
        form,
        activeItems,
        idempotencyKeyRef.current || newIdempotencyKey()
      );

      const cleanDigits: string = normalizeKuwaitPhone(form.phone);
      try {
        localStorage.setItem(
          `${SAVED_KW_ADDRESS_PREFIX}${cleanDigits}`,
          JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            governorate: form.governorate,
            area: form.area.trim(),
            block: form.block.trim(),
            street: form.street.trim(),
            building: form.building.trim(),
            floor: form.floor.trim(),
            apartment: form.apartment.trim(),
          })
        );
      } catch {
        // Ignore storage errors
      }

      if (isBuyNowMode && expressItem) {
        try {
          sessionStorage.removeItem(EXPRESS_BUY_NOW_KEY);
        } catch {
          // Ignore
        }
        setExpressItem(null);
      } else {
        clearCart();
      }

      const snapshot: CompletedOrderSnapshot = {
        orderNumber: order.orderNumber,
        total: orderSnapshotTotal,
        numItems: orderSnapshotItemsCount,
        contentIds: orderSnapshotIds,
      };

      try {
        sessionStorage.setItem(LAST_COMPLETED_ORDER_KEY, JSON.stringify(snapshot));
      } catch {
        // Ignore storage errors
      }

      if (trackedPurchaseRef.current !== order.orderNumber) {
        trackedPurchaseRef.current = order.orderNumber;
        trackMetaEvent("Purchase", {
          transaction_id: order.orderNumber,
          content_ids: orderSnapshotIds,
          content_type: "product",
          value: orderSnapshotTotal,
          currency: "KWD",
          num_items: orderSnapshotItemsCount,
        });
      }

      setOrderPhone(order.phone);
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

  const showEmpty: boolean = hydrated && activeItems.length === 0 && orderRef === null;
  const showSuccess: boolean = orderRef !== null;
  const currentStep: number = showSuccess ? 2 : 1;

  return (
    <>
      {GOOGLE_CLIENT_ID && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setGoogleReady(true)}
        />
      )}

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
                Your order number is <span className="font-semibold text-[#212529]">#{orderRef}</span>. Updates will be
                sent to your WhatsApp <span className="font-semibold text-[#212529]">{orderPhone}</span>.
              </p>
              <p className="mt-2 text-[13px] text-[#6c757d]">
                Use your order number and mobile number to track your delivery anytime.
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

          {hydrated && activeItems.length > 0 && !showSuccess && (
            <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-start">
              <div className="space-y-6">
                {/* Dual Option Top Bar: 1-Click Fill with Google + Guest Form */}
                <div className="bg-[#f8f9fa] border border-[#f1f5f9] rounded-lg p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-[14px] font-bold text-[#212529]">
                      Guest Checkout — No Account or Password Required
                    </p>
                    <p className="text-[12px] text-[#6c757d] mt-0.5">
                      1-Click Fill with Google for Name &amp; Gmail, or fill the Guest Checkout Form directly below.
                    </p>
                    {googleNotice && (
                      <p className="text-[12px] font-medium text-[#198754] mt-1.5">{googleNotice}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleGoogleFill}
                    className="h-11 px-4 rounded-md border border-[#dee2e6] bg-white hover:bg-[#f1f3f5] text-[#212529] text-[13px] font-semibold inline-flex items-center justify-center gap-2.5 shrink-0 transition-colors"
                  >
                    <GoogleIcon />
                    <span>1-Click Fill with Google</span>
                  </button>
                </div>

                <form id="checkout-form" onSubmit={handleSubmit} noValidate className="space-y-6">
                  <SectionCard step={1} title="WhatsApp & Contact Info" badge="WhatsApp-First • Email Optional">
                    {autofillNotice && (
                      <div className="mb-4 rounded-md border border-[#198754]/30 bg-[#e8f5ee] px-4 py-2.5 text-[13px] font-medium text-[#198754]">
                        {autofillNotice}
                      </div>
                    )}

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <FieldLabel htmlFor="phone">Kuwait WhatsApp Number</FieldLabel>
                        <div className="flex">
                          <span className="inline-flex h-12 items-center rounded-l-md border border-r-0 border-[#dee2e6] bg-[#f8f9fa] px-4 text-[15px] font-semibold text-[#212529]">
                            +965
                          </span>
                          <input
                            id="phone"
                            name="phone"
                            type="tel"
                            maxLength={8}
                            value={form.phone}
                            placeholder="5XXX XXXX"
                            autoComplete="tel-national"
                            inputMode="tel"
                            aria-invalid={Boolean(errors.phone)}
                            aria-describedby={errors.phone ? "phone-error" : undefined}
                            onChange={(e) =>
                              updateField("phone", e.target.value.replace(/\D/g, "").slice(0, 8))
                            }
                            className={`${inputClass(Boolean(errors.phone))} rounded-l-none`}
                          />
                        </div>
                        <FieldError id="phone-error" message={errors.phone} />
                        <p className="mt-1.5 text-[12px] text-[#6c757d]">
                          Order confirmation &amp; rider updates will be sent on WhatsApp.
                        </p>
                      </div>

                      <TextField
                        name="email"
                        label="Email address"
                        type="email"
                        optional
                        value={form.email}
                        error={errors.email}
                        onChange={(v) => updateField("email", v)}
                        autoComplete="email"
                        inputMode="email"
                        placeholder="you@example.com (optional)"
                        className="sm:col-span-2"
                      />
                    </div>
                  </SectionCard>

                  <SectionCard step={2} title="Kuwait Delivery Address">
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
                        onChange={handleGovernorateChange}
                      />

                      <AreaSelectField
                        governorate={form.governorate}
                        value={form.area}
                        customAreaMode={customAreaMode}
                        error={errors.area}
                        onSelectChange={handleAreaSelectChange}
                        onCustomAreaChange={(v) => updateField("area", v)}
                      />

                      <TextField
                        name="block"
                        label="Block"
                        inputMode="numeric"
                        placeholder="e.g. 10"
                        value={form.block}
                        error={errors.block}
                        onChange={(v) => updateField("block", v)}
                        autoComplete="address-line2"
                      />
                      <TextField
                        name="street"
                        label="Street"
                        placeholder="e.g. Street 5"
                        value={form.street}
                        error={errors.street}
                        onChange={(v) => updateField("street", v)}
                        autoComplete="street-address"
                      />

                      <TextField
                        name="building"
                        label="House or building number"
                        value={form.building}
                        error={errors.building}
                        onChange={(v) => updateField("building", v)}
                        autoComplete="address-line2"
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <TextField
                          name="floor"
                          label="Floor"
                          optional
                          inputMode="numeric"
                          value={form.floor}
                          onChange={(v) => updateField("floor", v)}
                          autoComplete="address-line2"
                        />
                        <TextField
                          name="apartment"
                          label="Apartment"
                          optional
                          inputMode="numeric"
                          value={form.apartment}
                          onChange={(v) => updateField("apartment", v)}
                          autoComplete="address-line2"
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
                      Flat delivery fee across Kuwait:{" "}
                      <span className="font-semibold text-[#212529]">{formatKD(DELIVERY_FEE_KD)}</span>.
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
              </div>

              <OrderSummary
                items={activeItems}
                subtotal={subtotal}
                itemCount={itemCount}
                deliveryFee={deliveryFee}
                total={total}
                isBuyNowMode={isBuyNowMode && Boolean(expressItem)}
                onQuantityChange={handleQuantityChange}
                onRemove={(id) => removeFromCart(id)}
              />
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default function CheckoutPage(): ReactNode {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" aria-busy="true" />}>
      <CheckoutContent />
    </Suspense>
  );
}