// Accepts "42" or a GraphQL global ID like base64("product:42"). Returns "42" or null.
export function normalizeProductId(raw: string | number): string | null {
  if (typeof raw === "number") return Number.isInteger(raw) && raw > 0 ? String(raw) : null;
  const value: string = raw.trim();
  if (/^\d{1,12}$/.test(value)) return String(Number(value));
  try {
    const decoded: string = atob(value);
    const match: RegExpMatchArray | null = decoded.match(/^[a-z_]+:(\d{1,12})$/i);
    return match ? String(Number(match[1])) : null;
  } catch {
    return null;
  }
}
