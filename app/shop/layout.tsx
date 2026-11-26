// app/shop/layout.tsx
import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE_URL: string = "https://shophope.online";

export const metadata: Metadata = {
  title: "Shop All Products in Kuwait",
  description:
    "Browse fashion, handbags, backpacks, footwear, beauty & everyday essentials in Kuwait at Shop & Hope. Filter by category, price (KD), color & size with Cash on Delivery.",
  alternates: {
    canonical: "/shop",
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/shop`,
    title: "Shop All Products in Kuwait | Shop & Hope Kuwait",
    description:
      "Explore curated fashion, bags, footwear & beauty items across Kuwait at shophope.online.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Shop All Products in Kuwait | Shop & Hope Kuwait",
    description:
      "Explore curated fashion, bags, footwear & beauty items across Kuwait at shophope.online.",
  },
};

const SHOP_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/shop/#collection`,
      url: `${SITE_URL}/shop`,
      name: "Shop All Products — Shop & Hope Kuwait",
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/shop` },
      ],
    },
  ],
};

export default function ShopLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SHOP_SCHEMA) }}
      />
      {children}
    </>
  );
}