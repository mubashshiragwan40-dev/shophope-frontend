// app/layout.tsx
import { Suspense, type ReactNode } from "react";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import "./globals.css";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className="min-h-screen bg-white text-[#212529] antialiased flex flex-col"
      >
        <Suspense fallback={<div className="h-[90px] bg-white" aria-hidden="true" />}>
          <SiteHeader />
        </Suspense>

        <main className="flex-1 pb-12 md:pb-0">{children}</main>

        <SiteFooter />
      </body>
    </html>
  );
}