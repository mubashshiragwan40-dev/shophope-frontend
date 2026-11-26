// app/sitemap.ts
import type { MetadataRoute } from "next";

const SITE_URL: string = "https://shophope.online";
const API_URL: string =
  process.env.NEXT_PUBLIC_WORDPRESS_API_URL || "https://backend.shophope.online/graphql";

interface SitemapProductNode {
  slug: string;
}

interface SitemapCategoryNode {
  slug: string;
}

async function fetchCatalogForSitemap(): Promise<{
  products: SitemapProductNode[];
  categories: SitemapCategoryNode[];
}> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query GetSitemapCatalog {
            products(first: 250) {
              nodes {
                slug
              }
            }
            productCategories(first: 100) {
              nodes {
                slug
              }
            }
          }
        `,
      }),
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return { products: [], categories: [] };
    }

    const json = (await res.json()) as {
      data?: {
        products?: { nodes?: SitemapProductNode[] };
        productCategories?: { nodes?: SitemapCategoryNode[] };
      };
    };

    return {
      products: json.data?.products?.nodes ?? [],
      categories: json.data?.productCategories?.nodes ?? [],
    };
  } catch {
    return { products: [], categories: [] };
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { products, categories } = await fetchCatalogForSitemap();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/shop`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/category`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/orders`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/privacy-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/refund-policy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = categories
    .filter((c) => c.slug && c.slug !== "uncategorized")
    .map((cat) => ({
      url: `${SITE_URL}/category/${cat.slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.75,
    }));

  const productRoutes: MetadataRoute.Sitemap = products
    .filter((p) => Boolean(p.slug))
    .map((prod) => ({
      url: `${SITE_URL}/product/${prod.slug}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.85,
    }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}