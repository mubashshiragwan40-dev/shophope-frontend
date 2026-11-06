// lib/checkout-validation.ts
import { KUWAIT_GOVERNORATES, type CheckoutCustomer } from "@/lib/orders";

export type CustomerFieldErrors = Partial<Record<keyof CheckoutCustomer, string>>;

export const EMAIL_RE: RegExp = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KUWAIT_MOBILE_RE: RegExp = /^[569]\d{7}$/;

/** Strips spaces, dashes and brackets, then the +965 / 00965 / 965 prefix. */
export function normalizeKuwaitPhone(value: string): string {
  const digits: string = value.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+965")) return digits.slice(4);
  if (digits.startsWith("00965")) return digits.slice(5);
  if (digits.startsWith("965") && digits.length === 11) return digits.slice(3);
  return digits;
}

/**
 * Validates the customer block. Returns clean data when valid, or field errors when not.
 * Never throws, so it is safe to use on untrusted input.
 */
export function validateCheckoutCustomer(input: unknown): {
  data: CheckoutCustomer | null;
  errors: CustomerFieldErrors;
} {
  const src: Record<string, unknown> =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const errors: CustomerFieldErrors = {};
  const clean: Record<string, string> = {};

  const readText = (key: keyof CheckoutCustomer, max: number, required: boolean): void => {
    const raw: unknown = src[key];
    const value: string = typeof raw === "string" ? raw.trim().replace(/\s+/g, " ") : "";
    if (required && value.length === 0) errors[key] = "This field is required.";
    else if (value.length > max) errors[key] = `Must be ${max} characters or fewer.`;
    clean[key] = value;
  };

  readText("firstName", 60, true);
  readText("lastName", 60, true);
  readText("governorate", 40, true);
  if (!errors.governorate && !KUWAIT_GOVERNORATES.includes(clean.governorate)) {
    errors.governorate = "Select a valid governorate.";
  }
  readText("area", 80, true);
  readText("block", 20, true);
  readText("street", 100, true);
  readText("building", 20, true);
  readText("floor", 20, false);
  readText("apartment", 20, false);
  readText("deliveryNote", 500, false);

  const email: string = typeof src.email === "string" ? src.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 120) {
    errors.email = "Enter a valid email address.";
  }

  const digits: string = typeof src.phone === "string" ? normalizeKuwaitPhone(src.phone.trim()) : "";
  if (!KUWAIT_MOBILE_RE.test(digits)) {
    errors.phone = "Enter an 8-digit Kuwait mobile number.";
  }

  if (Object.keys(errors).length > 0) return { data: null, errors };

  return {
    data: {
      firstName: clean.firstName,
      lastName: clean.lastName,
      email,
      phone: `+965${digits}`,
      governorate: clean.governorate,
      area: clean.area,
      block: clean.block,
      street: clean.street,
      building: clean.building,
      floor: clean.floor || undefined,
      apartment: clean.apartment || undefined,
      deliveryNote: clean.deliveryNote || undefined,
    },
    errors: {},
  };
}
