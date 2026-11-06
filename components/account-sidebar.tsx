// components/account-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense } from "react";
import { logout } from "@/lib/auth";

type SidebarVariant = "vertical" | "horizontal";

const links = [
  { href: "/my-account", label: "Dashboard", icon: "📋" },
  { href: "/my-account/orders", label: "Orders", icon: "📦" },
  { href: "/my-account/addresses", label: "Addresses", icon: "📍" },
  { href: "/my-account/details", label: "Account Details", icon: "👤" },
  { href: "/wishlist", label: "Wishlist", icon: "❤️" },
] as const;

function SidebarInner({ variant }: { variant: SidebarVariant }) {
  const pathname = usePathname();
  const router = useRouter();
  const isHorizontal = variant === "horizontal";

  async function handleLogout() {
    await logout();
    router.push("/my-account");
  }

  const itemBase =
    "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-[14px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]";

  return (
    <nav aria-label="Account navigation">
      <ul
        className={
          isHorizontal
            ? "flex gap-2 overflow-x-auto pb-2"
            : "space-y-1"
        }
      >
        {links.map((link) => {
          const active = pathname === link.href;
          return (
            <li key={link.href} className={isHorizontal ? "shrink-0" : undefined}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`${itemBase} ${
                  active
                    ? "bg-[#e91e63]/10 text-[#e91e63]"
                    : "text-[#212529] hover:bg-gray-100"
                }`}
              >
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
              </Link>
            </li>
          );
        })}
        <li className={isHorizontal ? "shrink-0" : undefined}>
          <button
            type="button"
            onClick={handleLogout}
            className={`${itemBase} w-full text-[#6c757d] hover:bg-gray-100`}
          >
            <span aria-hidden="true">🚪</span>
            Logout
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default function AccountSidebar({
  variant = "vertical",
}: {
  variant?: SidebarVariant;
}) {
  return (
    <Suspense fallback={null}>
      <SidebarInner variant={variant} />
    </Suspense>
  );
}
