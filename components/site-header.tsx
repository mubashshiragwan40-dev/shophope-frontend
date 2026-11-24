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

export const SHOP_OPEN_FILTERS_EVENT: string = "shophope-open-shop-filters";

const NAV_LINKS: Array<{ label: string; href: string }> = [
  { label: "HOME", href: "/" },
  { label: "SHOP", href: "/shop" },
  { label: "TRACK ORDER", href: "/orders" },
];

const MOBILE_MENU_ID: string = "mobile-menu";

/* ============================================================
   ICONS
   ============================================================ */
function BurgerIcon(): ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function CloseIcon(): ReactNode {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function UserIcon(): ReactNode {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SearchIcon(): ReactNode {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function HeartIcon(): ReactNode {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

function BasketIcon(): ReactNode {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function FilterGlyph(): ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

/* ============================================================
   HEADER + MOBILE BOTTOM BAR
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

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMenuOpen(false);
    setSearchOpen(false);
  }

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
  const isShopPage: boolean = pathname === "/shop";
  const isProductPage: boolean = pathname.startsWith("/product/");

  const isActive = (href: string): boolean =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const handleOpenShopFilters = (): void => {
    window.dispatchEvent(new Event(SHOP_OPEN_FILTERS_EVENT));
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-white border-b border-[#f1f5f9]">
        <div className="w-full h-[76px] md:h-[90px] px-4 lg:px-5 flex items-center justify-between gap-3">
          {/* Left: Burger on mobile, Logo on desktop */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls={MOBILE_MENU_ID}
              onClick={() => setMenuOpen((prev: boolean) => !prev)}
              className="md:hidden w-10 h-10 inline-flex items-center justify-center text-[#212529] hover:text-[#e91e63] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] rounded-md"
            >
              {menuOpen ? <CloseIcon /> : <BurgerIcon />}
            </button>

            <Link
              href="/"
              className="hidden md:flex items-center shrink-0 h-full rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
              aria-label="Shop & Hope home"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO_SRC} alt="" className="h-[72px] w-auto max-w-[200px] object-contain" />
            </Link>
          </div>

          {/* Center on mobile: Logo | Desktop: Nav links */}
          <Link
            href="/"
            className="md:hidden flex items-center justify-center shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
            aria-label="Shop & Hope home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_SRC} alt="Shop & Hope" className="h-[52px] w-auto max-w-[150px] object-contain" />
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

          {/* Right: Desktop actions + Mobile Profile icon */}
          <div className="flex items-center gap-2 sm:gap-5">
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
              className="hidden md:inline-flex text-[#212529] hover:text-[#e91e63] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] rounded"
            >
              <SearchIcon />
            </button>

            <Link
              href="/wishlist"
              aria-label={`Wishlist with ${wishlistCount} items`}
              className="hidden md:relative md:inline-flex text-[#212529] hover:text-[#e91e63] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] rounded"
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
              className="hidden md:relative md:flex items-center gap-2 text-[#212529] hover:text-[#e91e63] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] rounded"
            >
              <span className="relative">
                <BasketIcon />
                <span aria-hidden="true" className="absolute -top-2 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-[#e91e63] text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              </span>
              <span className="hidden sm:inline text-[16px] font-medium">{formatKD(cartTotal)}</span>
            </Link>

            {/* Mobile top-right Profile icon */}
            <Link
              href="/my-account"
              aria-label={accountLabel}
              aria-current={isActive("/my-account") ? "page" : undefined}
              className={`md:hidden w-10 h-10 inline-flex items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] ${
                isActive("/my-account") ? "text-[#e91e63]" : "text-[#212529] hover:text-[#e91e63]"
              }`}
            >
              <UserIcon />
            </Link>
          </div>
        </div>

        {/* Mobile always-accessible search bar */}
        <div className="md:hidden border-t border-[#f1f5f9] bg-[#f8f9fa] px-4 py-2.5">
          <ProductSearch onNavigate={() => setMenuOpen(false)} />
        </div>

        {/* Desktop Search bar (toggles from header search icon) */}
        {searchOpen && (
          <div id="header-search" className="hidden md:block w-full border-t border-[#f1f5f9] bg-white px-4 lg:px-5 py-4">
            <div className="mx-auto max-w-[1260px]">
              <ProductSearch autoFocus onNavigate={() => setSearchOpen(false)} />
            </div>
          </div>
        )}

        {/* Mobile Burger Drawer Menu */}
        {menuOpen && (
          <div id={MOBILE_MENU_ID} className="md:hidden border-t border-[#f1f5f9] bg-white shadow-lg">
            <div className="px-4 py-2 flex flex-col">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`py-3.5 text-[14px] font-semibold uppercase border-b border-[#f1f5f9] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] ${
                    isActive(link.href) ? "text-[#e91e63]" : "text-[#212529]"
                  }`}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/my-account"
                aria-current={isActive("/my-account") ? "page" : undefined}
                className={`py-3.5 text-[14px] font-semibold uppercase rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] ${
                  isActive("/my-account") ? "text-[#e91e63]" : "text-[#212529]"
                }`}
              >
                {accountLabel}
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Mobile Bottom Sticky Navigation Bar */}
      {!isProductPage && (
        <nav
          aria-label="Mobile quick actions"
          className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[#dee2e6] bg-white/95 backdrop-blur shadow-[0_-4px_16px_rgba(33,37,41,0.08)]"
        >
          <div className={`grid ${isShopPage ? "grid-cols-3" : "grid-cols-2"} divide-x divide-[#f1f5f9]`}>
            {isShopPage && (
              <button
                type="button"
                onClick={handleOpenShopFilters}
                className="flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-semibold text-[#212529] active:text-[#e91e63]"
              >
                <FilterGlyph />
                <span>Filters</span>
              </button>
            )}

            <Link
              href="/wishlist"
              className={`flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-semibold transition-colors ${
                isActive("/wishlist") ? "text-[#e91e63]" : "text-[#212529] hover:text-[#e91e63]"
              }`}
            >
              <span className="relative inline-flex">
                <HeartIcon />
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#e91e63] text-white text-[10px] font-bold flex items-center justify-center"
                >
                  {wishlistCount}
                </span>
              </span>
              <span>Wishlist</span>
            </Link>

            <Link
              href="/cart"
              className={`flex flex-col items-center justify-center py-2.5 gap-1 text-[11px] font-semibold transition-colors ${
                isActive("/cart") ? "text-[#e91e63]" : "text-[#212529] hover:text-[#e91e63]"
              }`}
            >
              <span className="relative inline-flex">
                <BasketIcon />
                <span
                  aria-hidden="true"
                  className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#e91e63] text-white text-[10px] font-bold flex items-center justify-center"
                >
                  {cartCount}
                </span>
              </span>
              <span>Cart ({formatKD(cartTotal)})</span>
            </Link>
          </div>
        </nav>
      )}
    </>
  );
}