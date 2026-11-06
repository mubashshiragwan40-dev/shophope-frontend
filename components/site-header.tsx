// components/site-header.tsx
"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ProductSearch from "./product-search";
import { WISHLIST_EVENT, readWishlist } from "@/lib/wishlist";
import { CART_EVENT, formatKD, readCart, type CartItem } from "@/lib/cart";
import { AUTH_EVENT, getStoredToken } from "@/lib/auth";

/* ============================================================
   CONSTANTS
   ============================================================ */
const LOGO_SRC: string = "/logo.png";

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: "HOME", href: "/" },
  { label: "SHOP", href: "/shop" },
  { label: "TRACK ORDER", href: "/orders" }, // TODO: confirm; account orders live at /my-account/orders
];

const MOBILE_MENU_ID: string = "mobile-menu";

/* ============================================================
   ICONS
   ============================================================ */
function SearchIcon(): ReactNode {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function HeartIcon(): ReactNode {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

function BasketIcon(): ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

/* ============================================================
   HEADER
   Reads cart, wishlist and login state from localStorage itself,
   so it needs no props and lives once in app/layout.tsx.
   ============================================================ */
export default function SiteHeader(): ReactNode {
  const pathname: string = usePathname();

  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [wishlistCount, setWishlistCount] = useState<number>(0);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [prevPathname, setPrevPathname] = useState<string>(pathname);

  const searchButtonRef = useRef<HTMLButtonElement>(null);

  /* Close the menu and the search bar whenever the page changes.
     State is adjusted during render (no effect needed), so there is no extra re-render pass. */
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

  /* Wishlist count */
  useEffect(() => {
    const sync = (): void => setWishlistCount(readWishlist().length);
    sync();
    window.addEventListener(WISHLIST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* Cart count and total */
  useEffect(() => {
    const sync = (): void => setCartItems(readCart());
    sync();
    window.addEventListener(CART_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CART_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* Login state (switches the label between LOGIN / REGISTER and MY ACCOUNT) */
  useEffect(() => {
    const sync = (): void => setIsLoggedIn(Boolean(getStoredToken()));
    sync();
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  /* Escape closes the search bar and returns focus to its trigger */
  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        searchButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [searchOpen]);

  const cartCount: number = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal: number = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const accountLabel: string = isLoggedIn ? "MY ACCOUNT" : "LOGIN / REGISTER";

  /* Highlights the link of the current page ("/" only matches the home page exactly) */
  const isActive = (href: string): boolean =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-50 w-full bg-white">
      <div className="w-full h-[90px] px-4 lg:px-5 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center shrink-0 h-full rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]" aria-label="Shop & Hope home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO_SRC} alt="" className="h-[72px] w-auto max-w-[200px] object-contain" />
        </Link>

        <nav className="hidden md:flex items-center gap-8 h-full" aria-label="Main navigation">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? "page" : undefined}
              className={`text-[16px] font-medium uppercase transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] ${
                isActive(link.href) ? "text-[#e91e63]" : "text-[#212529] hover:text-[#e91e63]"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/my-account"
            aria-current={isActive("/my-account") ? "page" : undefined}
            className={`hidden lg:inline text-[16px] font-medium uppercase transition-colors rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] ${
              isActive("/my-account") ? "text-[#e91e63]" : "text-[#212529] hover:text-[#e91e63]"
            }`}
          >
            {accountLabel}
          </Link>

          <button
            ref={searchButtonRef}
            type="button"
            aria-label="Search"
            aria-expanded={searchOpen}
            aria-controls="header-search"
            onClick={() => setSearchOpen((prev: boolean) => !prev)}
            className="text-[#212529] hover:text-[#e91e63] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] rounded"
          >
            <SearchIcon />
          </button>

          <Link
            href="/wishlist"
            aria-label={`Wishlist with ${wishlistCount} items`}
            className="relative text-[#212529] hover:text-[#e91e63] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] rounded"
          >
            <span className="relative inline-flex">
              <HeartIcon />
              <span aria-hidden="true" className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#e91e63] text-white text-[10px] font-bold flex items-center justify-center">
                {wishlistCount}
              </span>
            </span>
          </Link>

          <Link
            href="/cart"
            aria-label={`Cart with ${cartCount} items`}
            className="relative flex items-center gap-2 text-[#212529] hover:text-[#e91e63] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] rounded"
          >
            <span className="relative">
              <BasketIcon />
              <span aria-hidden="true" className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#e91e63] text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            </span>
            <span className="hidden sm:inline text-[16px] font-medium">{formatKD(cartTotal)}</span>
          </Link>

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls={MOBILE_MENU_ID}
            onClick={() => setMenuOpen((prev: boolean) => !prev)}
            className="md:hidden text-[#212529] hover:text-[#e91e63] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] rounded"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search bar (opens from the search icon) */}
      {searchOpen && (
        <div id="header-search" className="w-full border-t border-[#f1f5f9] bg-white px-4 lg:px-5 py-4">
          <div className="mx-auto max-w-[1260px]">
            <ProductSearch autoFocus onNavigate={() => setSearchOpen(false)} />
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {menuOpen && (
        <div id={MOBILE_MENU_ID} className="md:hidden border-t border-[#f1f5f9] bg-white">
          <div className="px-4 py-2 flex flex-col">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={`py-3 text-[14px] font-medium uppercase border-b border-[#f1f5f9] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] ${
                  isActive(link.href) ? "text-[#e91e63]" : "text-[#212529]"
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/my-account"
              aria-current={isActive("/my-account") ? "page" : undefined}
              className={`py-3 text-[14px] font-medium uppercase rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] ${
                isActive("/my-account") ? "text-[#e91e63]" : "text-[#212529]"
              }`}
            >
              {accountLabel}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
