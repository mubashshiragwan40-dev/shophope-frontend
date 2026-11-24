// lib/wishlist.ts
export interface WishlistItem {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  price: number;
}

export const WISHLIST_KEY: string = "shophope-wishlist";
export const WISHLIST_EVENT: string = "shophope-wishlist-updated";

/** Guards against corrupted or old data in localStorage. */
function isWishlistItem(value: unknown): value is WishlistItem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<WishlistItem>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.slug === "string" &&
    typeof v.name === "string" &&
    (typeof v.image === "string" || v.image === null) &&
    typeof v.price === "number" &&
    Number.isFinite(v.price)
  );
}

export function readWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: string | null = localStorage.getItem(WISHLIST_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isWishlistItem) : [];
  } catch {
    return [];
  }
}

export function writeWishlist(items: WishlistItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
  } catch {
    /* Storage full or disabled (private mode): keep the page working. */
  }
  window.dispatchEvent(new Event(WISHLIST_EVENT));
}

export function toggleWishlist(item: WishlistItem): boolean {
  const items: WishlistItem[] = readWishlist();
  const exists: boolean = items.some((i) => i.id === item.id);
  const next: WishlistItem[] = exists ? items.filter((i) => i.id !== item.id) : [...items, item];
  writeWishlist(next);
  return !exists;
}
