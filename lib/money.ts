// lib/money.ts
/** Converts a WooCommerce RAW amount string to a number for formatKD. */
export function toAmount(raw: string | null | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
