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

export function readWishlist(): WishlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw: string | null = localStorage.getItem(WISHLIST_KEY);
    return raw ? (JSON.parse(raw) as WishlistItem[]) : [];
  } catch {
    return [];
  }
}

export function writeWishlist(items: WishlistItem[]): void {
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(WISHLIST_EVENT));
}

export function toggleWishlist(item: WishlistItem): boolean {
  const items: WishlistItem[] = readWishlist();
  const exists: boolean = items.some((i) => i.id === item.id);
  const next: WishlistItem[] = exists ? items.filter((i) => i.id !== item.id) : [...items, item];
  writeWishlist(next);
  return !exists;
}
