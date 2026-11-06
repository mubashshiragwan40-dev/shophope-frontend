// app/my-account/addresses/page.tsx
"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import AuthGuard from "@/components/auth-guard";
import AccountSkeleton from "@/components/account-skeleton";
import SubmitButton from "@/components/submit-button";
import FieldError from "@/components/field-error";
import {
  getCustomer,
  updateCustomer,
  type Address,
  type Customer,
  type UpdateCustomerInput,
} from "@/lib/auth";
import { GraphQLError } from "@/lib/graphql";
import { normalizeKuwaitPhone } from "@/lib/checkout-validation";
import { KUWAIT_GOVERNORATES } from "@/lib/orders";

/* ============================================================
   TYPES & CONSTANTS
   ============================================================ */

/**
 * Single delivery address form.
 * Field names match checkout so both pages store the same data in WooCommerce.
 */
interface DeliveryAddressForm {
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2: string;
  governorate: string;
  area: string;
  deliveryNote: string;
}

type FormErrors = Partial<Record<keyof DeliveryAddressForm, string>>;

const KUWAIT_COUNTRY_CODE: string = "KW";
const KUWAIT_MOBILE_RE: RegExp = /^[569]\d{7}$/;

/* ============================================================
   HELPERS
   ============================================================ */

/**
 * Reads the saved shipping address into form values.
 * We store Kuwait address data in WooCommerce's "shipping" address:
 *   state   = governorate
 *   city    = area
 *   address1 = block, street, building
 *   address2 = floor, apartment, delivery note
 */
function toForm(address: Address | null | undefined): DeliveryAddressForm {
  return {
    firstName: address?.firstName ?? "",
    lastName: address?.lastName ?? "",
    phone: normalizeKuwaitPhone(address?.phone ?? ""),
    address1: address?.address1 ?? "",
    address2: address?.address2 ?? "",
    governorate: address?.state ?? "",
    area: address?.city ?? "",
    deliveryNote: "",
  };
}

/** Builds the WooCommerce address object. Empty strings clear old values. */
function buildAddress(form: DeliveryAddressForm): Address {
  const phone: string = normalizeKuwaitPhone(form.phone);
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    company: "",
    address1: form.address1.trim(),
    address2: form.address2.trim(),
    city: form.area.trim(),
    state: form.governorate,
    postcode: "",
    country: KUWAIT_COUNTRY_CODE,
    phone: phone ? `+965${phone}` : "",
    email: "",
  };
}

/** Validates the form. Phone is optional but must be valid when entered. */
function validateForm(form: DeliveryAddressForm): FormErrors {
  const errors: FormErrors = {};

  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";
  if (!form.governorate) errors.governorate = "Select your governorate.";
  if (!form.area.trim()) errors.area = "Area is required.";
  if (!form.address1.trim()) errors.address1 = "Block, street and building are required.";

  if (form.phone.trim() && !KUWAIT_MOBILE_RE.test(normalizeKuwaitPhone(form.phone))) {
    errors.phone = "Enter an 8-digit Kuwait mobile number (starts with 5, 6 or 9).";
  }

  return errors;
}

/**
 * Keeps a saved governorate in the dropdown even if it's not in the current list.
 */
function governorateOptions(current: string): string[] {
  const list: string[] = [...(KUWAIT_GOVERNORATES as ReadonlyArray<string>)];
  return current && !list.includes(current) ? [current, ...list] : list;
}

/**
 * Renders a saved address as static text.
 */
function SavedAddress({ address }: { address: Address }): ReactNode {
  return (
    <address className="not-italic text-sm text-[#212529] space-y-1">
      {(address.firstName || address.lastName) && (
        <p className="font-medium">
          {[address.firstName, address.lastName].filter(Boolean).join(" ")}
        </p>
      )}
      {address.phone && <p>{address.phone}</p>}
      {address.address1 && <p>{address.address1}</p>}
      {address.address2 && <p>{address.address2}</p>}
      <p>{[address.city, address.state].filter(Boolean).join(", ")}</p>
      <p>Kuwait</p>
    </address>
  );
}

/* ============================================================
   FORM FIELDS
   ============================================================ */

function inputClass(hasError: boolean): string {
  return `w-full rounded-md border px-3 py-2 text-sm text-[#212529] placeholder:text-[#6c757d] focus:border-[#e91e63] focus:outline-none focus:ring-1 focus:ring-[#e91e63] ${
    hasError ? "border-red-500" : "border-[#dee2e6]"
  }`;
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "text" | "tel" | "numeric";
  type?: string;
  className?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  required = false,
  placeholder,
  autoComplete,
  inputMode,
  type = "text",
  className = "",
}: FieldProps): ReactNode {
  const errorId: string = `${id}-error`;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[#212529]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass(Boolean(error))}
      />
      <FieldError id={errorId} message={error} />
    </div>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  error,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  error?: string;
  required?: boolean;
}): ReactNode {
  const errorId: string = `${id}-error`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-[#212529]">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <select
        id={id}
        name={id}
        value={value}
        required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass(Boolean(error))}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FieldError id={errorId} message={error} />
    </div>
  );
}

/* ============================================================
   PAGE
   ============================================================ */
export default function AddressesPage(): ReactNode {
  return (
    <AuthGuard>
      <AddressesContent />
    </AuthGuard>
  );
}

function AddressesContent(): ReactNode {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let active: boolean = true;

    getCustomer()
      .then((data) => {
        if (active) setCustomer(data);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof GraphQLError ? err.message : "Could not load your address.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) return <AccountSkeleton />;

  if (error || !customer) {
    return (
      <div
        role="alert"
        className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {error || "Could not load customer data."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[#212529]">Delivery Address</h2>
        <p className="mt-1 text-sm text-[#6c757d]">
          Your saved delivery address for Kuwait orders. This address can be used
          during checkout.
        </p>
      </div>

      <DeliveryAddressSection
        address={customer.shipping ?? null}
        onSaved={setCustomer}
      />
    </div>
  );
}

/* ============================================================
   DELIVERY ADDRESS SECTION
   Three states: empty (add), saved (view), and form (edit).
   ============================================================ */
function DeliveryAddressSection({
  address,
  onSaved,
}: {
  address: Address | null;
  onSaved: (customer: Customer) => void;
}): ReactNode {
  const [editing, setEditing] = useState<boolean>(false);
  const [form, setForm] = useState<DeliveryAddressForm>(() => toForm(address));
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  const hasAddress: boolean = Boolean(address?.address1 || address?.city);

  /** Reset the form from saved data every time editing starts. */
  const startEditing = (): void => {
    setForm(toForm(address));
    setErrors({});
    setFormError("");
    setSuccess("");
    setEditing(true);
  };

  const cancelEditing = (): void => {
    setEditing(false);
    setErrors({});
    setFormError("");
  };

  const handleChange = (field: keyof DeliveryAddressForm, value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next: FormErrors = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (saving) return;

    const nextErrors: FormErrors = validateForm(form);
    setErrors(nextErrors);
    setFormError("");

    const firstInvalid: string | undefined = Object.keys(nextErrors)[0];
    if (firstInvalid) {
      document.getElementById(`address-${firstInvalid}`)?.focus();
      return;
    }

    const input: UpdateCustomerInput = { shipping: buildAddress(form) };

    setSaving(true);
    try {
      const updated: Customer = await updateCustomer(input);
      onSaved(updated);
      setEditing(false);
      setSuccess("Delivery address saved.");
    } catch (err: unknown) {
      setFormError(
        err instanceof GraphQLError
          ? err.message
          : "Could not save your address. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  /* ── Empty state ── */
  if (!editing && !hasAddress) {
    return (
      <div className="rounded-lg border border-[#dee2e6] p-5">
        <p className="text-sm text-[#6c757d]">No delivery address saved yet.</p>
        <button
          type="button"
          onClick={startEditing}
          className="mt-4 text-sm font-medium text-[#e91e63] hover:underline focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        >
          Add address
        </button>
      </div>
    );
  }

  /* ── Saved address (view) ── */
  if (!editing && address) {
    return (
      <div className="rounded-lg border border-[#dee2e6] p-5">
        <SavedAddress address={address} />
        <button
          type="button"
          onClick={startEditing}
          className="mt-4 text-sm font-medium text-[#e91e63] hover:underline focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        >
          Edit
        </button>
        {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
      </div>
    );
  }

  /* ── Edit form ── */
  return (
    <form onSubmit={handleSubmit} noValidate className="rounded-lg border border-[#dee2e6] p-5">
      {formError && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {formError}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="address-firstName"
          label="First name"
          required
          value={form.firstName}
          error={errors.firstName}
          autoComplete="given-name"
          onChange={(v) => handleChange("firstName", v)}
        />
        <Field
          id="address-lastName"
          label="Last name"
          required
          value={form.lastName}
          error={errors.lastName}
          autoComplete="family-name"
          onChange={(v) => handleChange("lastName", v)}
        />
        <Field
          id="address-phone"
          label="Mobile number"
          type="tel"
          inputMode="tel"
          value={form.phone}
          error={errors.phone}
          placeholder="5XXX XXXX"
          autoComplete="tel-national"
          onChange={(v) => handleChange("phone", v)}
        />
        <Field
          id="address-area"
          label="Area"
          required
          value={form.area}
          error={errors.area}
          placeholder="e.g. Salmiya"
          autoComplete="address-level2"
          onChange={(v) => handleChange("area", v)}
        />
        <SelectField
          id="address-governorate"
          label="Governorate"
          required
          value={form.governorate}
          error={errors.governorate}
          options={governorateOptions(form.governorate)}
          onChange={(v) => handleChange("governorate", v)}
        />
        <div /> {/* grid spacer */}
        <Field
          id="address-address1"
          label="Block, street and building"
          required
          value={form.address1}
          error={errors.address1}
          placeholder="e.g. Block 10, Street 5, Building 12"
          autoComplete="address-line1"
          className="sm:col-span-2"
          onChange={(v) => handleChange("address1", v)}
        />
        <Field
          id="address-address2"
          label="Floor and apartment (optional)"
          value={form.address2}
          placeholder="e.g. Floor 3, Apartment 7"
          autoComplete="address-line2"
          className="sm:col-span-2"
          onChange={(v) => handleChange("address2", v)}
        />
      </div>

      <div className="mt-5 flex gap-3">
        <SubmitButton loading={saving} label="Save" />
        <button
          type="button"
          onClick={cancelEditing}
          className="rounded-md border border-[#dee2e6] px-6 py-2.5 text-[14px] font-semibold uppercase text-[#6c757d] transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#e91e63]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
