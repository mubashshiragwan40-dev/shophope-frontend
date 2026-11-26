// app/layout.tsx
import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import SiteHeader from "@/components/site-header";
import SiteFooter from "@/components/site-footer";
import "./globals.css";

const SITE_URL: string = "https://shophope.online";
const SITE_NAME: string = "Shop & Hope";
const LEGAL_NAME: string = "شركة مكافاه لبيع بالتجزئة للهدايا والكماليات";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Shop & Hope Kuwait — Fashion, Beauty, Bags & Lifestyle Online",
    template: "%s | Shop & Hope Kuwait",
  },
  description:
    "Shop the latest women's fashion, handbags, backpacks, footwear, beauty & lifestyle deals in Kuwait at Shop & Hope (shophope.online). Fast Kuwait delivery & Cash on Delivery.",
  keywords: [
    "Shop and Hope Kuwait",
    "shophope.online",
    "online shopping Kuwait",
    "women fashion Kuwait",
    "handbags Kuwait",
    "backpacks Kuwait",
    "beauty products Kuwait",
    "cash on delivery Kuwait",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_KW",
    url: SITE_URL,
    title: "Shop & Hope Kuwait — Fashion, Beauty, Bags & Lifestyle Online",
    description:
      "Discover curated fashion, handbags, footwear, beauty & everyday essentials across Kuwait with fast delivery and Cash on Delivery.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Shop & Hope Kuwait",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Shop & Hope Kuwait — Fashion, Beauty & Lifestyle Online",
    description:
      "Shop fashion, handbags, beauty & lifestyle deals across Kuwait at shophope.online.",
    images: ["/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

const ORGANIZATION_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      legalName: LEGAL_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.png`,
      },
      contactPoint: [
        {
          "@type": "ContactPoint",
          telephone: "+965-99429456",
          contactType: "customer service",
          areaServed: "KW",
          availableLanguage: ["English", "Arabic"],
        },
      ],
      address: {
        "@type": "PostalAddress",
        addressLocality: "Mubarak Al-Kabeer",
        addressCountry: "KW",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/shop?search={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        suppressHydrationWarning
        className="min-h-screen bg-white text-[#212529] antialiased flex flex-col"
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_SCHEMA) }}
        />

        <Suspense fallback={<div className="h-[90px] bg-white" aria-hidden="true" />}>
          <SiteHeader />
        </Suspense>

        <main className="flex-1 pb-12 md:pb-0">{children}</main>

        <SiteFooter />
      </body>
    </html>
  );
}