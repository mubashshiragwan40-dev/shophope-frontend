// app/category/layout.tsx
import type { ReactNode } from "react";
import type { Metadata } from "next";

const SITE_URL: string = "https://shophope.online";

export const metadata: Metadata = {
  title: "Product Categories in Kuwait",
  description:
    "Explore fashion, handbags, backpacks, footwear, beauty, luggage & lifestyle categories in Kuwait at Shop & Hope. Fast Kuwait delivery & Cash on Delivery.",
  alternates: {
    canonical: "/category",
  },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/category`,
    title: "Product Categories in Kuwait | Shop & Hope Kuwait",
    description:
      "Browse all product categories across Kuwait at shophope.online with Cash on Delivery.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Product Categories in Kuwait | Shop & Hope Kuwait",
    description:
      "Browse all product categories across Kuwait at shophope.online with Cash on Delivery.",
  },
};

const CATEGORY_INDEX_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CollectionPage",
      "@id": `${SITE_URL}/category/#collection`,
      url: `${SITE_URL}/category`,
      name: "Product Categories — Shop & Hope Kuwait",
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Categories", item: `${SITE_URL}/category` },
      ],
    },
  ],
};

export default function CategoryLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(CATEGORY_INDEX_SCHEMA) }}
      />
      {children}
    </>
  );
}