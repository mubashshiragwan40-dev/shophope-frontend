// app/layout.tsx
import { Suspense, type ReactNode } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
// Tailwind CSS poori website par load ho, isliye ye import zaroori hai:
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="min-h-screen bg-white text-[#212529] antialiased flex flex-col">
        {/* usePathname() runtime par milta hai, isliye header ko Suspense mein rakhna zaroori hai */}
        <Suspense fallback={<div className="h-[90px] bg-white" aria-hidden="true" />}>
          <SiteHeader />
        </Suspense>

        <main className="flex-1">{children}</main>

        <SiteFooter />
      </body>
    </html>
  );
}
