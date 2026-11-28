// app/product/[slug]/page.tsx
import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import ProductClient from "./product-client";

const SITE_URL: string = "https://shophope.online";
const API_URL: string =
  process.env.NEXT_PUBLIC_WORDPRESS_API_URL || "https://backend.shophope.online/graphql";

interface SeoProductNode {
  databaseId: number;
  name: string;
  slug: string;
  sku?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  price?: string | null;
  regularPrice?: string | null;
  stockStatus?: string | null;
  image?: { sourceUrl: string } | null;
  productCategories?: {
    nodes: Array<{ name: string; slug: string }>;
  } | null;
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parsePriceNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = stripHtml(raw);
  const match = text.match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const num = parseFloat(match[0].replace(",", "."));
  return Number.isFinite(num) ? num.toFixed(3) : null;
}

async function fetchProductSeo(slug: string): Promise<SeoProductNode | null> {
  if (!slug) return null;
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query GetProductSeo($slug: ID!) {
            product(id: $slug, idType: SLUG) {
              databaseId
              name
              slug
              sku
              shortDescription
              description
              ... on InventoriedProduct {
                stockStatus
              }
              ... on SimpleProduct {
                price
                regularPrice
              }
              ... on VariableProduct {
                price
                regularPrice
              }
              image {
                sourceUrl
              }
              productCategories {
                nodes {
                  name
                  slug
                }
              }
            }
          }
        `,
        variables: { slug },
      }),
      next: { revalidate: 300 },
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { product?: SeoProductNode | null } };
    return json.data?.product ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await fetchProductSeo(slug);

  if (!product) {
    return {
      title: "Product Details",
      alternates: { canonical: `/product/${slug}` },
    };
  }

  const priceStr = parsePriceNumber(product.price);
  const cleanDesc =
    stripHtml(product.shortDescription) ||
    stripHtml(product.description) ||
    `Buy ${product.name} online in Kuwait at Shop & Hope. Fast Kuwait delivery & Cash on Delivery available.`;
  const metaDesc = cleanDesc.slice(0, 158);
  const titleText = priceStr
    ? `${product.name} (KD ${priceStr}) in Kuwait`
    : `${product.name} in Kuwait`;
  const imageUrl = product.image?.sourceUrl || `${SITE_URL}/logo.png`;

  return {
    title: titleText,
    description: metaDesc,
    alternates: {
      canonical: `/product/${product.slug}`,
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/product/${product.slug}`,
      title: `${titleText} | Shop & Hope Kuwait`,
      description: metaDesc,
      images: [
        {
          url: imageUrl,
          alt: product.name,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${titleText} | Shop & Hope Kuwait`,
      description: metaDesc,
      images: [imageUrl],
    },
  };
}

async function ProductJsonLd({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const product = await fetchProductSeo(slug);
  if (!product) return null;

  const priceStr = parsePriceNumber(product.price);
  const category = product.productCategories?.nodes?.[0];
  const productUrl = `${SITE_URL}/product/${product.slug}`;
  const imageUrl = product.image?.sourceUrl || `${SITE_URL}/logo.png`;
  const description =
    stripHtml(product.shortDescription) ||
    stripHtml(product.description) ||
    product.name;

  const breadcrumbItems: Array<Record<string, unknown>> = [
    { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
    { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/shop` },
  ];

  if (category) {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: category.name,
      item: `${SITE_URL}/shop?category=${category.slug}`,
    });
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 4,
      name: product.name,
      item: productUrl,
    });
  } else {
    breadcrumbItems.push({
      "@type": "ListItem",
      position: 3,
      name: product.name,
      item: productUrl,
    });
  }

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Product",
        name: product.name,
        image: [imageUrl],
        description,
        sku: product.sku || String(product.databaseId),
        brand: {
          "@type": "Brand",
          name: "Shop & Hope",
        },
        ...(priceStr
          ? {
              offers: {
                "@type": "Offer",
                url: productUrl,
                priceCurrency: "KWD",
                price: priceStr,
                availability:
                  product.stockStatus === "OUT_OF_STOCK"
                    ? "https://schema.org/OutOfStock"
                    : "https://schema.org/InStock",
                itemCondition: "https://schema.org/NewCondition",
                seller: {
                  "@type": "Organization",
                  name: "Shop & Hope",
                },
              },
            }
          : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbItems,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export default function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): ReactNode {
  return (
    <>
      <Suspense fallback={null}>
        <ProductJsonLd params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <ProductClient />
      </Suspense>
    </>
  );
}