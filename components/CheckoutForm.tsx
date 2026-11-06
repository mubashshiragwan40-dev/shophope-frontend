// components/CheckoutForm.tsx
"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  DELIVERY_FEE_KD,
  KUWAIT_GOVERNORATES,
  type CartLine,
  type CheckoutCustomer,
  type CreateOrderRequest,
  type CreateOrderResponse,
} from "@/lib/orders";
import { validateCheckoutCustomer, type CustomerFieldErrors } from "@/lib/checkout-validation";

interface CheckoutFormProps {
  items: CartLine[];
  subtotalKd: number;
}

type FormState = Record<keyof CheckoutCustomer, string>;

const EMPTY_FORM: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  governorate: "",
  area: "",
  block: "",
  street: "",
  building: "",
  floor: "",
  apartment: "",
  deliveryNote: "",
};

/** Random key that also works on non-HTTPS origins (where crypto.randomUUID is unavailable). */
function newIdempotencyKey(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
}

export default function CheckoutForm({ items, subtotalKd }: CheckoutFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<CustomerFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  /* Reuses the key when the payload is unchanged (safe retry), and makes a new one when it changes. */
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const name = e.target.name as keyof FormState;
    const value: string = e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    if (items.length === 0) {
      setFormError("Your cart is empty.");
      return;
    }

    const { data, errors: fieldErrors } = validateCheckoutCustomer(form);
    setErrors(fieldErrors);
    if (!data) {
      setFormError("Please check the highlighted fields.");
      return;
    }

    const body: CreateOrderRequest = {
      customer: data,
      items,
      delivery: "standard",
      payment: "cod",
    };
    const fingerprint: string = JSON.stringify(body);
    const key: string =
      attempt.current?.fingerprint === fingerprint ? attempt.current.key : newIdempotencyKey();
    attempt.current = { fingerprint, key };

    setSubmitting(true);
    let succeeded: boolean = false;

    try {
      const res: Response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: fingerprint,
      });

      const payload = (await res.json().catch(() => null)) as
        | (Partial<CreateOrderResponse> & { error?: string; fields?: CustomerFieldErrors })
        | null;

      if (!res.ok || !payload?.orderNumber) {
        if (payload?.fields) setErrors(payload.fields);
        setFormError(payload?.error ?? "Something went wrong. Please try again.");
        return;
      }

      succeeded = true;
      router.push(`/order-confirmation?order=${encodeURIComponent(payload.orderNumber)}`);
    } catch {
      setFormError("Network error. Please check your connection and try again.");
    } finally {
      /* Stay disabled after success, while the page navigates. */
      if (!succeeded) setSubmitting(false);
    }
  }

  const fee: number = DELIVERY_FEE_KD;
  const total: number = subtotalKd + fee;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <section>
        <h2 className="font-semibold">Contact information</h2>
        <Field label="Email address" name="email" type="email" value={form.email} error={errors.email} onChange={handleChange} autoComplete="email" />
        <div>
          <label htmlFor="phone" className="block text-sm">Mobile number *</label>
          <div className="flex">
            <span className="inline-flex items-center px-3 border border-r-0 rounded-l">+965</span>
            <input
              id="phone"
              name="phone"
              inputMode="numeric"
              maxLength={14}
              placeholder="5XXXXXXX"
              value={form.phone}
              onChange={handleChange}
              className="w-full border rounded-r px-3 py-2"
            />
          </div>
          <p className="text-xs text-gray-500">Enter your 8-digit Kuwait mobile number.</p>
          {errors.phone && <p className="text-sm text-red-600">{errors.phone}</p>}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <h2 className="sm:col-span-2 font-semibold">Delivery address</h2>
        <Field label="First name" name="firstName" value={form.firstName} error={errors.firstName} onChange={handleChange} autoComplete="given-name" />
        <Field label="Last name" name="lastName" value={form.lastName} error={errors.lastName} onChange={handleChange} autoComplete="family-name" />

        <div>
          <label htmlFor="governorate" className="block text-sm">Governorate *</label>
          <select id="governorate" name="governorate" value={form.governorate} onChange={handleChange} className="w-full border rounded px-3 py-2">
            <option value="">Select</option>
            {KUWAIT_GOVERNORATES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          {errors.governorate && <p className="text-sm text-red-600">{errors.governorate}</p>}
        </div>

        <Field label="Area" name="area" value={form.area} error={errors.area} onChange={handleChange} />
        <Field label="Block" name="block" value={form.block} error={errors.block} onChange={handleChange} />
        <Field label="Street" name="street" value={form.street} error={errors.street} onChange={handleChange} />
        <Field label="House or building number" name="building" value={form.building} error={errors.building} onChange={handleChange} />
        <Field label="Floor (optional)" name="floor" value={form.floor} error={errors.floor} onChange={handleChange} />
        <Field label="Apartment (optional)" name="apartment" value={form.apartment} error={errors.apartment} onChange={handleChange} />

        <div className="sm:col-span-2">
          <label htmlFor="deliveryNote" className="block text-sm">Delivery instructions (optional)</label>
          <textarea id="deliveryNote" name="deliveryNote" rows={3} value={form.deliveryNote} onChange={handleChange} className="w-full border rounded px-3 py-2" />
          {errors.deliveryNote && <p className="text-sm text-red-600">{errors.deliveryNote}</p>}
        </div>
      </section>

      <section>
        <h2 className="font-semibold">Payment method</h2>
        <p className="border rounded p-3">Cash on delivery. Pay in cash (KD) when your order arrives.</p>
      </section>

      <section className="space-y-1 text-sm">
        <div className="flex justify-between"><span>Subtotal</span><span>KD {subtotalKd.toFixed(3)}</span></div>
        <div className="flex justify-between"><span>Delivery</span><span>KD {fee.toFixed(3)}</span></div>
        <div className="flex justify-between font-semibold"><span>Total</span><span>KD {total.toFixed(3)}</span></div>
        <p className="text-xs text-gray-500">The final total is calculated by the server.</p>
      </section>

      {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}

      <button
        type="submit"
        disabled={submitting || items.length === 0}
        className="w-full rounded bg-black px-4 py-3 text-white disabled:opacity-50"
      >
        {submitting ? "Placing order..." : `PLACE ORDER - KD ${total.toFixed(3)}`}
      </button>
    </form>
  );
}

function Field(props: {
  label: string;
  name: keyof FormState;
  value: string;
  error?: string;
  type?: string;
  autoComplete?: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  const id: string = props.name;
  return (
    <div>
      <label htmlFor={id} className="block text-sm">{props.label}</label>
      <input
        id={id}
        name={props.name}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        value={props.value}
        onChange={props.onChange}
        className="w-full border rounded px-3 py-2"
      />
      {props.error && <p className="text-sm text-red-600">{props.error}</p>}
    </div>
  );
}
