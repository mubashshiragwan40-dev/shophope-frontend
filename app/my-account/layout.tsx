// app/my-account/layout.tsx
// ------------------------------------------------------------------
// Shared layout for all /my-account/* routes.
// Desktop: sidebar on the left. Mobile: horizontal tabs at the top.
// Marks all account pages as noindex.
// ------------------------------------------------------------------

import type { Metadata } from "next";
import type { ReactNode } from "react";
import AccountSidebar from "@/components/account-sidebar";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function MyAccountLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-2xl font-bold text-[#212529]">My Account</h1>

      {/* Mobile: horizontal scrollable tabs */}
      <div className="mb-6 lg:hidden">
        <AccountSidebar variant="horizontal" />
      </div>

      <div className="lg:flex lg:gap-10">
        {/* Desktop: vertical sidebar */}
        <aside className="hidden lg:block lg:w-56 lg:shrink-0">
          <AccountSidebar variant="vertical" />
        </aside>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
