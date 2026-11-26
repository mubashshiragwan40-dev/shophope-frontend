// app/product/[slug]/product-client.tsx
"use client";


export const EXPRESS_BUY_NOW_KEY: string = "shophope-express-buy-now";
import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { addToCart } from "@/lib/cart";
import { WISHLIST_EVENT, readWishlist, toggleWishlist } from "@/lib/wishlist";

/* ============================================================
   TYPES
   ============================================================ */
interface VariationAttribute {
  name: string;
  value: string;
}

interface GraphQLVariation {
  id: string;
  databaseId: number;
  name: string;
  price: string | null;
  regularPrice: string | null;
  image: { sourceUrl: string } | null;
  attributes: { nodes: VariationAttribute[] } | null;
}

interface GraphQLProduct {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  price?: string | null;
  regularPrice?: string | null;
  image: { sourceUrl: string } | null;
  productCategories: { nodes: Array<{ name: string; slug: string }> } | null;
  productTags: { nodes: Array<{ name: string; slug: string }> } | null;
  variations?: { nodes: GraphQLVariation[] } | null;
}

interface ProductResponse {
  data?: { product?: GraphQLProduct | null };
  errors?: Array<{ message: string }>;
}

interface ProductsResponse {
  data?: { products?: { nodes: GraphQLProduct[] } };
  errors?: Array<{ message: string }>;
}

interface InfoItem {
  id: string;
  title: string;
  content: ReactNode;
}

/* ============================================================
   CONSTANTS
   ============================================================ */
const API_URL: string =
  process.env.NEXT_PUBLIC_WORDPRESS_API_URL || "https://backend.shophope.online/graphql";

const PRODUCT_QUERY: string = `
  query GetProduct($slug: ID!) {
    product(id: $slug, idType: SLUG) {
      id
      databaseId
      name
      slug
      description
      shortDescription
      ... on SimpleProduct {
        price
        regularPrice
      }
      ... on VariableProduct {
        price
        regularPrice
        variations(first: 50) {
          nodes {
            id
            databaseId
            name
            price
            regularPrice
            image {
              sourceUrl
            }
            attributes {
              nodes {
                name
                value
              }
            }
          }
        }
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
      productTags {
        nodes {
          name
          slug
        }
      }
    }
  }
`;

const RELATED_QUERY: string = `
  query GetRelatedProducts {
    products(first: 8) {
      nodes {
        id
        databaseId
        name
        slug
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
  }
`;

const SHIPPING_POINTS: string[] = [
  "The product will be shipped within 2-3 working days and delivered within 4-5 working days from the day of dispatch.",
  "We dispatch your shipment within 24 hours of you making a request to ship.",
  "Your order will reach you safe and sound within 3-6 days.",
  "Tracking is available for all products, so you can follow your delivery from dispatch to arrival.",
];

/* ============================================================
   HELPERS
   ============================================================ */
function htmlToText(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent ?? "";
}

function parseAmount(html: string | null | undefined): number | null {
  if (!html) return null;
  const match = htmlToText(html).match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const value = parseFloat(match[0].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function getDiscountPercent(
  price: string | null | undefined,
  regularPrice: string | null | undefined
): number | null {
  const current = parseAmount(price);
  const regular = parseAmount(regularPrice);
  if (current === null || regular === null || regular <= current) return null;
  return Math.round(((regular - current) / regular) * 100);
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return htmlToText(html).trim();
}

/* ============================================================
   ICONS
   ============================================================ */
function HeartIcon({ filled = false }: { filled?: boolean }): ReactNode {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

/* ============================================================
   PRODUCT GALLERY
   ============================================================ */
function ProductGallery({
  name,
  src,
  discount,
}: {
  name: string;
  src: string | null;
  discount: number | null;
}): ReactNode {
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const [lastSrc, setLastSrc] = useState<string | null>(src);

  if (src !== lastSrc) {
    setLastSrc(src);
    setImgFailed(false);
  }

  const showImage: boolean = Boolean(src) && !imgFailed;

  return (
    <div className="relative w-full aspect-square bg-[#f8f9fa] border border-[#f1f5f9] overflow-hidden">
      {discount !== null && (
        <span className="absolute top-4 left-4 z-10 bg-[#e91e63] text-white text-[13px] font-bold w-[56px] h-[56px] rounded-full flex items-center justify-center">
          {`-${discount}%`}
        </span>
      )}

      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src ?? undefined}
          alt={name}
          onError={() => setImgFailed(true)}
          className="w-full h-full object-contain p-6"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <svg
            viewBox="0 0 200 150"
            className="max-h-[160px] w-auto"
            role="img"
            aria-label="Product image placeholder"
          >
            <rect
              x="62"
              y="40"
              width="76"
              height="76"
              rx="14"
              fill="#ffffff"
              stroke="#212529"
              strokeWidth="5"
            />
            <rect x="76" y="22" width="48" height="20" rx="6" fill="#e91e63" />
            <circle cx="100" cy="80" r="16" fill="#fde4ec" />
          </svg>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   INFO ACCORDION
   ============================================================ */
function InfoAccordion({ items }: { items: InfoItem[] }): ReactNode {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="mt-8 border-t border-[#f1f5f9]">
      {items.map((item) => {
        const isOpen: boolean = openId === item.id;
        return (
          <div key={item.id} className="border-b border-[#f1f5f9]">
            <button
              type="button"
              id={`accordion-btn-${item.id}`}
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${item.id}`}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="w-full flex items-center justify-between py-4 text-left group"
            >
              <span
                className={`text-[15px] font-semibold uppercase tracking-wide transition-colors ${
                  isOpen ? "text-[#e91e63]" : "text-[#212529] group-hover:text-[#e91e63]"
                }`}
              >
                {item.title}
              </span>
              <span className="text-[20px] leading-none text-[#e91e63]" aria-hidden="true">
                {isOpen ? "−" : "+"}
              </span>
            </button>

            {isOpen && (
              <div
                id={`accordion-panel-${item.id}`}
                role="region"
                aria-labelledby={`accordion-btn-${item.id}`}
                className="pb-5 text-[14px] leading-relaxed text-[#495057]"
              >
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   SHARE BUTTONS
   ============================================================ */
function ShareButtons({ title }: { title: string }): ReactNode {
  const [copied, setCopied] = useState<boolean>(false);

  const url: string = useSyncExternalStore(
    () => () => {},
    () => window.location.href,
    () => ""
  );

  const encodedUrl: string = encodeURIComponent(url);
  const encodedTitle: string = encodeURIComponent(title);

  const shareLinks: Array<{ label: string; href: string }> = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}` },
    {
      label: "Pinterest",
      href: `https://pinterest.com/pin/create/button/?url=${encodedUrl}&description=${encodedTitle}`,
    },
    { label: "Email", href: `mailto:?subject=${encodedTitle}&body=${encodedUrl}` },
  ];

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[14px] font-semibold text-[#212529] mr-2">Share:</span>
      {shareLinks.map((item) => (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 px-3 inline-flex items-center border border-[#dee2e6] text-[13px] font-medium text-[#212529] rounded-md hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
        >
          {item.label}
        </a>
      ))}
      <button
        type="button"
        onClick={handleCopy}
        className="h-9 px-3 inline-flex items-center border border-[#dee2e6] text-[13px] font-medium text-[#212529] rounded-md hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}

/* ============================================================
   RELATED PRODUCT CARD
   ============================================================ */
function RelatedCard({ product }: { product: GraphQLProduct }): ReactNode {
  const [imgFailed, setImgFailed] = useState<boolean>(false);
  const discount: number | null = getDiscountPercent(product.price, product.regularPrice);
  const showImage: boolean = Boolean(product.image?.sourceUrl) && !imgFailed;
  const href: string = `/product/${product.slug}`;

  return (
    <article className="group relative flex flex-col h-full bg-white border border-[#f1f5f9] shadow-[0_2px_12px_rgba(33,37,41,0.06)] hover:shadow-[0_10px_30px_rgba(33,37,41,0.12)] transition-shadow duration-300">
      {discount !== null && (
        <span className="absolute top-3 left-3 z-10 bg-[#e91e63] text-white text-[13px] font-bold w-[52px] h-[52px] rounded-full flex items-center justify-center">
          {`-${discount}%`}
        </span>
      )}

      <div className="p-3 pb-0">
        <Link
          href={href}
          aria-label={product.name}
          className="block w-full aspect-square overflow-hidden bg-[#f8f9fa]"
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.image?.sourceUrl}
              alt={product.name}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <svg
                viewBox="0 0 200 150"
                className="max-h-[120px] w-auto"
                role="img"
                aria-label="Product image placeholder"
              >
                <rect
                  x="62"
                  y="40"
                  width="76"
                  height="76"
                  rx="14"
                  fill="#ffffff"
                  stroke="#212529"
                  strokeWidth="5"
                />
                <rect x="76" y="22" width="48" height="20" rx="6" fill="#e91e63" />
                <circle cx="100" cy="80" r="16" fill="#fde4ec" />
              </svg>
            </div>
          )}
        </Link>
      </div>

      <div className="flex flex-col flex-1 p-4">
        <Link
          href={href}
          title={product.name}
          className="block truncate text-[16px] font-normal text-[#212529] hover:text-[#e91e63] transition-colors"
        >
          {product.name}
        </Link>

        <div className="mt-auto pt-3 flex flex-wrap items-baseline gap-2">
          {product.price && (
            <span
              className="text-[16px] font-bold text-[#e91e63]"
              dangerouslySetInnerHTML={{ __html: product.price }}
            />
          )}
          {discount !== null && product.regularPrice && (
            <span
              className="text-[14px] text-[#6c757d] line-through"
              dangerouslySetInnerHTML={{ __html: product.regularPrice }}
            />
          )}
        </div>

        <Link
          href={href}
          className="mt-3 h-[46px] inline-flex items-center justify-center bg-[#e91e63] hover:bg-[#c2185b] text-white text-[14px] font-semibold uppercase rounded-md transition-colors"
        >
          View product
        </Link>
      </div>
    </article>
  );
}

/* ============================================================
   PAGE
   ============================================================ */
export default function ProductClient(): ReactNode {
  const params = useParams<{ slug: string }>();
  const slug: string = typeof params?.slug === "string" ? params.slug : "";

  const [product, setProduct] = useState<GraphQLProduct | null>(null);
  const [related, setRelated] = useState<GraphQLProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState<number>(1);
  const [isWishlisted, setIsWishlisted] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!product) return;
    const sync = (): void => setIsWishlisted(readWishlist().some((i) => i.id === product.id));
    sync();
    window.addEventListener(WISHLIST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [product]);

  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();

    async function loadProduct(): Promise<void> {
      try {
        setLoading(true);
        setError(null);

        const [productRes, relatedRes] = await Promise.all([
          fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: PRODUCT_QUERY, variables: { slug } }),
            signal: controller.signal,
          }),
          fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: RELATED_QUERY }),
            signal: controller.signal,
          }),
        ]);

        if (!productRes.ok) throw new Error(`GraphQL request failed with status ${productRes.status}`);

        const productJson: ProductResponse = await productRes.json();
        if (productJson.errors && productJson.errors.length > 0) {
          throw new Error(productJson.errors[0].message);
        }

        const found: GraphQLProduct | null = productJson.data?.product ?? null;
        if (!found) throw new Error("Product not found.");
        setProduct(found);
        setSelectedAttrs({});
        setQuantity(1);

        if (relatedRes.ok) {
          const relatedJson: ProductsResponse = await relatedRes.json();
          const nodes: GraphQLProduct[] = relatedJson.data?.products?.nodes ?? [];
          setRelated(nodes.filter((p) => p.slug !== found.slug).slice(0, 4));
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load product.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadProduct();
    return () => controller.abort();
  }, [slug, reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const variations: GraphQLVariation[] = useMemo(
    () => product?.variations?.nodes ?? [],
    [product]
  );

  const attributeGroups: Array<{ name: string; options: string[] }> = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const v of variations) {
      for (const attr of v.attributes?.nodes ?? []) {
        if (!attr.name || !attr.value) continue;
        if (!map.has(attr.name)) map.set(attr.name, new Set<string>());
        map.get(attr.name)?.add(attr.value);
      }
    }
    return Array.from(map.entries()).map(([name, set]) => ({
      name,
      options: Array.from(set),
    }));
  }, [variations]);

  const matchedVariation: GraphQLVariation | null = useMemo(() => {
    if (variations.length === 0) return null;
    if (attributeGroups.length === 0) return variations[0] ?? null;

    const exact = variations.find((v) =>
      attributeGroups.every((group) => {
        const chosen = selectedAttrs[group.name];
        if (!chosen) return false;
        const foundAttr = (v.attributes?.nodes ?? []).find((a) => a.name === group.name);
        return foundAttr?.value === chosen;
      })
    );
    return exact ?? null;
  }, [variations, attributeGroups, selectedAttrs]);

  const activePrice: string | null =
    matchedVariation?.price || product?.price || null;
  const activeRegularPrice: string | null =
    matchedVariation?.regularPrice || product?.regularPrice || null;
  const activeImage: string | null =
    matchedVariation?.image?.sourceUrl || product?.image?.sourceUrl || null;
  const activeCartId: string = matchedVariation
    ? String(matchedVariation.databaseId)
    : String(product?.databaseId ?? "");
  const activeCartName: string = matchedVariation
    ? `${product?.name ?? ""} — ${matchedVariation.name}`
    : (product?.name ?? "");

  const discount: number | null = useMemo(
    () => getDiscountPercent(activePrice, activeRegularPrice),
    [activePrice, activeRegularPrice]
  );

  const categories: Array<{ name: string; slug: string }> = product?.productCategories?.nodes ?? [];
  const tags: Array<{ name: string; slug: string }> = product?.productTags?.nodes ?? [];
  const descriptionText: string =
    stripHtml(product?.description) || stripHtml(product?.shortDescription);

  const infoItems: InfoItem[] = [
    {
      id: "description",
      title: "Description",
      content: <p className="whitespace-pre-line">{descriptionText || "No description available."}</p>,
    },
    {
      id: "shipping",
      title: "Shipping & Delivery",
      content: (
        <div className="space-y-5">
          <div>
            <h3 className="text-[14px] font-bold uppercase text-[#212529] mb-2">
              Fast and safe delivery
            </h3>
            <p>
              We deliver your product with safety and security in mind. You can track your
              product&apos;s progress through the delivery process.
            </p>
          </div>
          <div>
            <h3 className="text-[14px] font-bold uppercase text-[#212529] mb-2">
              Our shipping system
            </h3>
            <ul className="list-disc pl-5 space-y-2">
              {SHIPPING_POINTS.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        </div>
      ),
    },
  ];

  const handleAddToCart = (): void => {
    if (!product) return;
    if (attributeGroups.length > 0 && !matchedVariation) {
      setToast("Please select all options first");
      return;
    }
    const price: number = parseAmount(activePrice) ?? 0;
    addToCart(
      {
        id: activeCartId,
        slug: product.slug,
        name: activeCartName,
        image: activeImage,
        price,
      },
      quantity
    );
    setToast(`Added: ${activeCartName} (x${quantity})`);
  };

  const handleToggleWishlist = (): void => {
    if (!product) return;
    const added: boolean = toggleWishlist({
      id: product.id,
      slug: product.slug,
      name: product.name,
      image: activeImage,
      price: parseAmount(activePrice) ?? 0,
    });
    setIsWishlisted(added);
    setToast(added ? "Added to wishlist" : "Removed from wishlist");
  };

  return (
    <>
      <section className="bg-[#f8f9fa] border-b border-[#f1f5f9]">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-4">
          <nav aria-label="Breadcrumb" className="text-sm text-[#6c757d]">
            <Link href="/" className="hover:text-[#e91e63] transition-colors">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link href="/shop" className="hover:text-[#e91e63] transition-colors">
              Shop
            </Link>
            {categories[0] && (
              <>
                <span className="mx-2">/</span>
                <span>{categories[0].name}</span>
              </>
            )}
            {product && (
              <>
                <span className="mx-2">/</span>
                <span className="text-[#212529]">{product.name}</span>
              </>
            )}
          </nav>
        </div>
      </section>

      {loading && (
        <section className="bg-white py-10">
          <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 grid gap-10 lg:grid-cols-2">
            <div className="aspect-square bg-[#f8f9fa] animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 bg-[#f8f9fa] animate-pulse" />
              <div className="h-6 w-1/3 bg-[#f8f9fa] animate-pulse" />
              <div className="h-24 w-full bg-[#f8f9fa] animate-pulse" />
            </div>
          </div>
        </section>
      )}

      {!loading && error && (
        <section className="bg-white py-16">
          <div
            role="alert"
            className="max-w-xl mx-auto text-center border border-[#f1f5f9] p-8 bg-[#f8f9fa]"
          >
            <p className="font-bold text-[#212529]">We couldn&apos;t load this product.</p>
            <p className="mt-1 text-sm text-[#6c757d]">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-5 bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-full transition-colors"
            >
              RETRY
            </button>
          </div>
        </section>
      )}

      {!loading && !error && product && (
        <>
          <section className="bg-white py-8 lg:py-12">
            <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 grid gap-10 lg:grid-cols-2">
              <ProductGallery name={product.name} src={activeImage} discount={discount} />

              <div className="flex flex-col">
                <h1 className="text-[28px] sm:text-[32px] leading-tight font-semibold text-[#212529]">
                  {product.name}
                </h1>

                <div className="mt-4 flex flex-wrap items-baseline gap-3">
                  {activePrice && (
                    <span
                      className="text-[22px] font-bold text-[#e91e63]"
                      dangerouslySetInnerHTML={{ __html: activePrice }}
                    />
                  )}
                  {discount !== null && activeRegularPrice && (
                    <span
                      className="text-[16px] text-[#6c757d] line-through"
                      dangerouslySetInnerHTML={{ __html: activeRegularPrice }}
                    />
                  )}
                </div>

                {product.shortDescription && (
                  <div
                    className="mt-5 text-[15px] leading-relaxed text-[#495057]"
                    dangerouslySetInnerHTML={{ __html: product.shortDescription }}
                  />
                )}

                {/* Variation selectors */}
                {attributeGroups.length > 0 && (
                  <div className="mt-6 space-y-4">
                    {attributeGroups.map((group) => {
                      const currentVal = selectedAttrs[group.name] ?? "";
                      return (
                        <div key={group.name}>
                          <div className="flex items-center justify-between mb-2">
                            <label
                              htmlFor={`attr-${group.name}`}
                              className="text-[14px] font-semibold text-[#212529]"
                            >
                              {group.name}
                            </label>
                            {currentVal && (
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedAttrs((prev) => {
                                    const next = { ...prev };
                                    delete next[group.name];
                                    return next;
                                  })
                                }
                                className="text-xs text-[#6c757d] hover:text-[#e91e63] underline"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                          <select
                            id={`attr-${group.name}`}
                            value={currentVal}
                            onChange={(e) =>
                              setSelectedAttrs((prev) => ({
                                ...prev,
                                [group.name]: e.target.value,
                              }))
                            }
                            className="w-full h-11 px-3 border border-[#dee2e6] rounded-md text-sm bg-white text-[#212529] focus:outline-none focus:border-[#e91e63]"
                          >
                            <option value="">Choose an option</option>
                            {group.options.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Quantity + actions */}
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center h-[52px] border border-[#dee2e6] rounded-md w-fit">
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-12 h-full text-lg hover:text-[#e91e63] transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={quantity}
                      aria-label="Quantity"
                      onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                      className="w-12 h-full text-center text-[15px] font-semibold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-12 h-full text-lg hover:text-[#e91e63] transition-colors"
                    >
                      +
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={!activePrice}
                    className="flex-1 h-[52px] px-8 bg-[#e91e63] hover:bg-[#c2185b] disabled:bg-[#f1f5f9] disabled:text-[#6c757d] active:scale-[0.98] text-white text-[15px] font-semibold uppercase rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] focus-visible:ring-offset-2"
                  >
                    ADD TO CART
                  </button>

                  <button
                    type="button"
                    onClick={handleToggleWishlist}
                    aria-pressed={isWishlisted}
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                    className={`w-[52px] h-[52px] shrink-0 inline-flex items-center justify-center border rounded-md transition-colors ${
                      isWishlisted
                        ? "bg-[#e91e63] border-[#e91e63] text-white"
                        : "bg-white border-[#dee2e6] text-[#212529] hover:border-[#e91e63] hover:text-[#e91e63]"
                    }`}
                  >
                    <HeartIcon filled={isWishlisted} />
                  </button>
                </div>

                {/* Meta */}
                <div className="mt-8 pt-6 border-t border-[#f1f5f9] space-y-4 text-[14px]">
                  {categories.length > 0 && (
                    <p>
                      <span className="font-semibold text-[#212529]">Categories: </span>
                      <span className="text-[#6c757d]">
                        {categories.map((c) => c.name).join(" , ")}
                      </span>
                    </p>
                  )}

                  {tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[#212529] mr-1">Tags:</span>
                      {tags.map((tag) => (
                        <Link
                          key={tag.slug}
                          href={`/shop?tag=${tag.slug}`}
                          className="h-8 px-3 inline-flex items-center bg-[#f8f9fa] border border-[#f1f5f9] rounded-full text-[13px] text-[#495057] hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
                        >
                          {tag.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="pt-2">
                    <ShareButtons title={product.name} />
                  </div>
                </div>

                <InfoAccordion items={infoItems} />
              </div>
            </div>
          </section>

          {related.length > 0 && (
            <section className="bg-[#f8f9fa] py-12">
              <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
                <h2 className="text-center text-3xl sm:text-4xl font-bold text-[#212529] mb-8">
                  Related products
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {related.map((p) => (
                    <RelatedCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      <div
        aria-live="polite"
        className={`fixed bottom-6 right-6 z-[60] max-w-[280px] bg-[#212529] text-white text-sm font-medium px-5 py-3 rounded-lg shadow-xl flex items-center gap-2 transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0 pointer-events-none"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#e91e63] shrink-0" />
        <span className="line-clamp-1">{toast ?? ""}</span>
      </div>
    </>
  );
}