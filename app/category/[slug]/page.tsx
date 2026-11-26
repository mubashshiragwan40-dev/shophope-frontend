// app/category/[slug]/page.tsx
import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL: string = "https://shophope.online";
const API_URL: string =
  process.env.NEXT_PUBLIC_WORDPRESS_API_URL || "https://backend.shophope.online/graphql";

interface CategoryNode {
  databaseId?: number;
  name: string;
  slug: string;
  description?: string | null;
}

interface CategoryProductNode {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  price?: string | null;
  image?: { sourceUrl: string } | null;
}

function formatSlugTitle(slug: string): string {
  return slug
    .replace(/[-_]+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchCategoryData(slug: string): Promise<{
  category: CategoryNode | null;
  products: CategoryProductNode[];
}> {
  if (!slug) return { category: null, products: [] };
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `
          query GetCategorySeo($slug: ID!, $categorySlug: String!) {
            productCategory(id: $slug, idType: SLUG) {
              databaseId
              name
              slug
              description
            }
            products(first: 24, where: { categoryIn: [$categorySlug] }) {
              nodes {
                id
                databaseId
                name
                slug
                ... on SimpleProduct {
                  price
                }
                ... on VariableProduct {
                  price
                }
                image {
                  sourceUrl
                }
              }
            }
          }
        `,
        variables: { slug, categorySlug: slug },
      }),
      next: { revalidate: 300 },
    });

    if (!res.ok) return { category: null, products: [] };
    const json = (await res.json()) as {
      data?: {
        productCategory?: CategoryNode | null;
        products?: { nodes?: CategoryProductNode[] };
      };
    };

    return {
      category: json.data?.productCategory ?? null,
      products: json.data?.products?.nodes ?? [],
    };
  } catch {
    return { category: null, products: [] };
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await fetchCategoryData(slug);
  const label = category?.name || formatSlugTitle(slug);
  const desc = (
    stripHtml(category?.description) ||
    `Shop ${label} online in Kuwait at Shop & Hope (shophope.online). Latest styles, competitive KD pricing & Cash on Delivery across Kuwait.`
  ).slice(0, 158);

  return {
    title: `${label} in Kuwait`,
    description: desc,
    alternates: {
      canonical: `/category/${slug}`,
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}/category/${slug}`,
      title: `${label} in Kuwait | Shop & Hope Kuwait`,
      description: desc,
    },
    twitter: {
      card: "summary_large_image",
      title: `${label} in Kuwait | Shop & Hope Kuwait`,
      description: desc,
    },
  };
}

async function CategoryContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const { category, products } = await fetchCategoryData(slug);
  const label = category?.name || formatSlugTitle(slug);
  const categoryUrl = `${SITE_URL}/category/${slug}`;

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${categoryUrl}/#collection`,
        url: categoryUrl,
        name: `${label} — Shop & Hope Kuwait`,
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: "Categories", item: `${SITE_URL}/category` },
          { "@type": "ListItem", position: 3, name: label, item: categoryUrl },
        ],
      },
    ],
  };

  return (
    <section className="bg-white py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-xs sm:text-sm text-[#6c757d] mb-4">
          <Link href="/" className="hover:text-[#e91e63] transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/category" className="hover:text-[#e91e63] transition-colors">
            Categories
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[#212529] font-medium">{label}</span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 mb-6 border-b border-[#e9ecef]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#e91e63]">
              Category Collection
            </p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-bold text-[#212529]">{label}</h1>
            {category?.description && (
              <p className="mt-2 text-sm text-[#495057] max-w-2xl">
                {stripHtml(category.description)}
              </p>
            )}
          </div>

          <Link
            href="/shop"
            className="inline-flex h-10 px-4 items-center justify-center rounded-lg border border-[#dee2e6] bg-white hover:border-[#e91e63] text-[#212529] hover:text-[#e91e63] text-xs font-semibold uppercase tracking-wide transition-colors w-fit"
          >
            All products
          </Link>
        </div>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {products.map((item) => (
              <Link
                key={item.id}
                href={`/product/${item.slug}`}
                className="group flex flex-col bg-white rounded-xl border border-[#e9ecef] overflow-hidden hover:shadow-[0_10px_24px_rgba(33,37,41,0.08)] transition-all"
              >
                <div className="aspect-square bg-[#f8f9fa] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image?.sourceUrl || "/logo.png"}
                    alt={item.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-3 sm:p-4 flex flex-col flex-1 gap-1.5">
                  <h2 className="text-xs sm:text-sm font-semibold text-[#212529] line-clamp-2 group-hover:text-[#e91e63] transition-colors">
                    {item.name}
                  </h2>
                  <span className="mt-auto pt-2 inline-flex h-9 items-center justify-center rounded-lg bg-[#212529] group-hover:bg-[#e91e63] text-white text-[11px] font-semibold uppercase tracking-wide transition-colors">
                    View product
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-[#f8f9fa] border border-[#e9ecef] rounded-xl">
            <p className="text-sm text-[#495057]">
              Explore our full catalog in the main store.
            </p>
            <Link
              href="/shop"
              className="mt-4 inline-flex h-10 px-5 items-center justify-center rounded-lg bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-semibold uppercase tracking-wide transition-colors"
            >
              Go to Shop
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

export default function CategorySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): ReactNode {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-[#6c757d]">Loading category...</div>}>
      <CategoryContent params={params} />
    </Suspense>
  );
}