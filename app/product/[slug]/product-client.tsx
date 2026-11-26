// app/product/[slug]/product-client.tsx
"use client";

export const EXPRESS_BUY_NOW_KEY: string = "shophope-express-buy-now";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { addToCart, formatKD, type CartItem } from "@/lib/cart";
import { WISHLIST_EVENT, readWishlist, toggleWishlist } from "@/lib/wishlist";
import { trackMetaEvent } from "@/components/meta-pixel";
import ProtectedProductImage from "@/components/protected-product-image";

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
  "Orders are dispatched within 24 hours of confirmation and typically delivered within 3–6 working days across Kuwait.",
  "Every shipment includes order tracking so you can follow your delivery from dispatch to doorstep.",
  "Cash on Delivery (COD) is available with clear order confirmation before dispatch.",
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

function formatOptionLabel(raw: string): string {
  const cleaned = raw.replace(/[-_]+/g, " ").trim();
  if (cleaned.length <= 3 && cleaned === cleaned.toLowerCase()) {
    return cleaned.toUpperCase();
  }
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/* ============================================================
   ICONS
   ============================================================ */
function HeartIcon({ filled = false }: { filled?: boolean }): ReactNode {
  return (
    <svg
      width="19"
      height="19"
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
  return (
    <div className="relative w-full aspect-square bg-[#f8f9fa] rounded-2xl border border-[#e9ecef] overflow-hidden">
      {discount !== null && (
        <span className="absolute top-3.5 left-3.5 z-10 bg-[#e91e63] text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-sm">
          {`-${discount}%`}
        </span>
      )}

      <ProtectedProductImage
        src={src}
        alt={name}
        imgClassName="w-full h-full object-contain p-3 sm:p-6"
      />
    </div>
  );
}

/* ============================================================
   INFO ACCORDION
   ============================================================ */
function InfoAccordion({ items }: { items: InfoItem[] }): ReactNode {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);

  return (
    <div className="mt-7 border-t border-[#e9ecef]">
      {items.map((item) => {
        const isOpen: boolean = openId === item.id;
        return (
          <div key={item.id} className="border-b border-[#e9ecef]">
            <button
              type="button"
              id={`accordion-btn-${item.id}`}
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${item.id}`}
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="w-full flex items-center justify-between py-4 text-left group"
            >
              <span
                className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                  isOpen ? "text-[#e91e63]" : "text-[#212529] group-hover:text-[#e91e63]"
                }`}
              >
                {item.title}
              </span>
              <span className="text-lg font-semibold leading-none text-[#495057]" aria-hidden="true">
                {isOpen ? "−" : "+"}
              </span>
            </button>

            {isOpen && (
              <div
                id={`accordion-panel-${item.id}`}
                role="region"
                aria-labelledby={`accordion-btn-${item.id}`}
                className="pb-4 text-sm leading-relaxed text-[#495057]"
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
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
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
      <span className="text-xs font-bold uppercase tracking-wider text-[#6c757d] mr-1">
        Share:
      </span>
      {shareLinks.map((item) => (
        <a
          key={item.label}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="h-8 px-3 inline-flex items-center border border-[#dee2e6] bg-white text-xs font-medium text-[#212529] rounded-lg hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
        >
          {item.label}
        </a>
      ))}
      <button
        type="button"
        onClick={handleCopy}
        className="h-8 px-3 inline-flex items-center border border-[#dee2e6] bg-white text-xs font-medium text-[#212529] rounded-lg hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}

/* ============================================================
   RELATED PRODUCT CARD
   ============================================================ */
function RelatedCard({ product }: { product: GraphQLProduct }): ReactNode {
  const discount: number | null = getDiscountPercent(product.price, product.regularPrice);
  const priceNum: number | null = parseAmount(product.price);
  const regularNum: number | null = parseAmount(product.regularPrice);
  const href: string = `/product/${product.slug}`;

  return (
    <article className="group relative flex flex-col h-full bg-white rounded-xl border border-[#e9ecef] overflow-hidden shadow-[0_1px_4px_rgba(33,37,41,0.04)] hover:border-[#dee2e6] hover:shadow-[0_10px_24px_rgba(33,37,41,0.08)] transition-all duration-200">
      {discount !== null && (
        <span className="absolute top-2.5 left-2.5 z-10 bg-[#e91e63] text-white text-[11px] font-bold px-2 py-0.5 rounded-md">
          {`-${discount}%`}
        </span>
      )}

      <div className="p-2.5 sm:p-3 pb-0">
        <Link
          href={href}
          aria-label={product.name}
          className="block w-full aspect-square rounded-lg overflow-hidden bg-[#f8f9fa]"
        >
          <ProtectedProductImage
            src={product.image?.sourceUrl}
            alt={product.name}
            imgClassName="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>
      </div>

      <div className="flex flex-col flex-1 p-3 sm:p-4 gap-1.5">
        <Link
          href={href}
          title={product.name}
          className="line-clamp-2 min-h-[36px] sm:min-h-[40px] text-[13px] sm:text-[14.5px] font-semibold leading-snug text-[#212529] hover:text-[#e91e63] transition-colors"
        >
          {product.name}
        </Link>

        <div className="mt-auto pt-2 flex flex-wrap items-baseline gap-1.5">
          {priceNum !== null ? (
            <span className="text-sm sm:text-[15px] font-bold text-[#212529]">
              {formatKD(priceNum)}
            </span>
          ) : (
            <span className="text-xs font-semibold text-[#6c757d]">Select options</span>
          )}
          {discount !== null && regularNum !== null && (
            <span className="text-xs text-[#6c757d] line-through">
              {formatKD(regularNum)}
            </span>
          )}
        </div>

        <Link
          href={href}
          className="mt-2 h-10 inline-flex items-center justify-center bg-[#212529] hover:bg-[#e91e63] text-white text-xs font-semibold uppercase tracking-wide rounded-lg transition-colors whitespace-nowrap"
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
  const router = useRouter();
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
  const [descExpanded, setDescExpanded] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const trackedViewIdRef = useRef<number | null>(null);

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
    if (!product) return;
    if (trackedViewIdRef.current === product.databaseId) return;
    trackedViewIdRef.current = product.databaseId;

    const initialPrice = parseAmount(product.price) ?? 0;
    const categoryName = product.productCategories?.nodes?.[0]?.name;

    trackMetaEvent("ViewContent", {
      content_ids: [String(product.databaseId)],
      content_name: product.name,
      content_type: "product",
      content_category: categoryName,
      value: initialPrice,
      currency: "KWD",
    });
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
        setDescExpanded(false);

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

  const activePrice: string | null = matchedVariation?.price || product?.price || null;
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

  const numericPrice: number | null = parseAmount(activePrice);
  const numericRegularPrice: number | null = parseAmount(activeRegularPrice);
  const discount: number | null = useMemo(
    () => getDiscountPercent(activePrice, activeRegularPrice),
    [activePrice, activeRegularPrice]
  );

  const categories: Array<{ name: string; slug: string }> = product?.productCategories?.nodes ?? [];
  const tags: Array<{ name: string; slug: string }> = product?.productTags?.nodes ?? [];
  const shortDescText: string = stripHtml(product?.shortDescription);
  const descriptionText: string = stripHtml(product?.description) || shortDescText;

  const missingOption: boolean = attributeGroups.length > 0 && !matchedVariation;

  const infoItems: InfoItem[] = [
    {
      id: "description",
      title: "Product details",
      content: (
        <p className="whitespace-pre-line">
          {descriptionText || "Detailed product specification available upon request."}
        </p>
      ),
    },
    {
      id: "shipping",
      title: "Shipping & delivery",
      content: (
        <ul className="list-disc pl-5 space-y-2">
          {SHIPPING_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      ),
    },
  ];

  const handleAddToCart = (): void => {
    if (!product) return;
    if (missingOption) {
      setToast("Please select all options first");
      return;
    }
    const unitPrice = numericPrice ?? 0;
    addToCart(
      {
        id: activeCartId,
        slug: product.slug,
        name: activeCartName,
        image: activeImage,
        price: unitPrice,
      },
      quantity
    );
    trackMetaEvent("AddToCart", {
      content_ids: [activeCartId],
      content_name: activeCartName,
      content_type: "product",
      value: Number((unitPrice * quantity).toFixed(3)),
      currency: "KWD",
    });
    setToast(`Added ${quantity} × ${activeCartName}`);
  };

  const handleBuyNow = (): void => {
    if (!product || numericPrice === null) return;
    if (missingOption) {
      setToast("Please select all options first");
      return;
    }
    const expressItem: CartItem = {
      id: activeCartId,
      slug: product.slug,
      name: activeCartName,
      image: activeImage,
      price: numericPrice,
      quantity,
    };
    try {
      sessionStorage.setItem(EXPRESS_BUY_NOW_KEY, JSON.stringify(expressItem));
    } catch {
      addToCart(
        {
          id: expressItem.id,
          slug: expressItem.slug,
          name: expressItem.name,
          image: expressItem.image,
          price: expressItem.price,
        },
        quantity
      );
    }
    trackMetaEvent("InitiateCheckout", {
      content_ids: [activeCartId],
      content_name: activeCartName,
      content_type: "product",
      value: Number((numericPrice * quantity).toFixed(3)),
      currency: "KWD",
      num_items: quantity,
    });
    router.push("/checkout?mode=buy_now");
  };

  const handleToggleWishlist = (): void => {
    if (!product) return;
    const added: boolean = toggleWishlist({
      id: product.id,
      slug: product.slug,
      name: product.name,
      image: activeImage,
      price: numericPrice ?? 0,
    });
    setIsWishlisted(added);
    setToast(added ? "Added to wishlist" : "Removed from wishlist");
  };

  return (
    <div className="pb-24 lg:pb-0">
      <section className="bg-[#f8f9fa] border-b border-[#e9ecef]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <nav aria-label="Breadcrumb" className="text-xs sm:text-sm text-[#6c757d] truncate">
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
                <span className="text-[#212529] font-medium">{product.name}</span>
              </>
            )}
          </nav>
        </div>
      </section>

      {loading && (
        <section className="bg-white py-8 lg:py-12">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 grid gap-8 lg:grid-cols-2">
            <div className="aspect-square rounded-2xl bg-[#f8f9fa] border border-[#e9ecef] animate-pulse" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 rounded-lg bg-[#f8f9fa] animate-pulse" />
              <div className="h-6 w-1/3 rounded-lg bg-[#f8f9fa] animate-pulse" />
              <div className="h-24 w-full rounded-lg bg-[#f8f9fa] animate-pulse" />
            </div>
          </div>
        </section>
      )}

      {!loading && error && (
        <section className="bg-white py-14">
          <div
            role="alert"
            className="max-w-xl mx-auto text-center border border-[#e9ecef] p-8 bg-[#f8f9fa] rounded-xl"
          >
            <p className="font-bold text-[#212529]">We couldn&apos;t load this product.</p>
            <p className="mt-1 text-sm text-[#6c757d]">{error}</p>
            <button
              type="button"
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-5 bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </section>
      )}

      {!loading && !error && product && (
        <>
          <section className="bg-white py-5 sm:py-8 lg:py-12">
            <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 grid gap-6 lg:gap-12 lg:grid-cols-2 items-start">
              <div className="lg:sticky lg:top-24">
                <ProductGallery name={product.name} src={activeImage} discount={discount} />
              </div>

              <div className="flex flex-col min-w-0">
                {categories.length > 0 && (
                  <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#6c757d] mb-1">
                    {categories.map((c) => c.name).join(" · ")}
                  </p>
                )}

                <h1 className="text-xl sm:text-[30px] leading-snug font-bold text-[#212529]">
                  {product.name}
                </h1>

                <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
                  {numericPrice !== null ? (
                    <span className="text-xl sm:text-2xl font-bold text-[#212529]">
                      {formatKD(numericPrice)}
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-[#6c757d]">Select options</span>
                  )}
                  {discount !== null && numericRegularPrice !== null && (
                    <span className="text-xs sm:text-sm text-[#6c757d] line-through">
                      {formatKD(numericRegularPrice)}
                    </span>
                  )}
                </div>

                {shortDescText && (
                  <div className="mt-3.5 text-xs sm:text-sm leading-relaxed text-[#495057]">
                    <p className={descExpanded ? "" : "line-clamp-3 sm:line-clamp-none"}>
                      {shortDescText}
                    </p>
                    {shortDescText.length > 130 && (
                      <button
                        type="button"
                        onClick={() => setDescExpanded((prev) => !prev)}
                        className="sm:hidden mt-1 text-xs font-semibold text-[#e91e63] hover:text-[#c2185b]"
                      >
                        {descExpanded ? "Show less" : "Read more"}
                      </button>
                    )}
                  </div>
                )}

                {attributeGroups.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-[#e9ecef] space-y-4">
                    {attributeGroups.map((group) => {
                      const currentVal = selectedAttrs[group.name] ?? "";
                      return (
                        <div key={group.name}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-[#212529]">
                              {formatOptionLabel(group.name)}
                              {currentVal ? `: ${formatOptionLabel(currentVal)}` : ""}
                            </span>
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
                                className="text-xs font-medium text-[#6c757d] hover:text-[#e91e63] transition-colors"
                              >
                                Clear
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {group.options.map((opt) => {
                              const isSelected = currentVal === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() =>
                                    setSelectedAttrs((prev) => ({
                                      ...prev,
                                      [group.name]: prev[group.name] === opt ? "" : opt,
                                    }))
                                  }
                                  aria-pressed={isSelected}
                                  className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold border transition-colors ${
                                    isSelected
                                      ? "bg-[#212529] border-[#212529] text-white"
                                      : "bg-white border-[#dee2e6] text-[#212529] hover:border-[#e91e63] hover:text-[#e91e63]"
                                  }`}
                                >
                                  {formatOptionLabel(opt)}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-[#e9ecef] space-y-2.5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center h-11 border border-[#dee2e6] rounded-lg bg-white shrink-0">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="w-9 sm:w-10 h-full text-base font-semibold hover:text-[#e91e63] transition-colors"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={quantity}
                        aria-label="Quantity"
                        onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
                        className="w-9 sm:w-11 h-full text-center text-sm font-semibold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => setQuantity((q) => q + 1)}
                        className="w-9 sm:w-10 h-full text-base font-semibold hover:text-[#e91e63] transition-colors"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={numericPrice === null}
                      className="flex-1 min-w-0 h-11 px-3 sm:px-5 border border-[#212529] bg-white hover:bg-[#f8f9fa] disabled:opacity-45 text-[#212529] text-xs sm:text-sm font-semibold uppercase tracking-wide rounded-lg transition-colors whitespace-nowrap"
                    >
                      Add to cart
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleWishlist}
                      aria-pressed={isWishlisted}
                      aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                      className={`w-11 h-11 shrink-0 inline-flex items-center justify-center border rounded-lg transition-colors ${
                        isWishlisted
                          ? "bg-[#e91e63] border-[#e91e63] text-white"
                          : "bg-white border-[#dee2e6] text-[#212529] hover:border-[#e91e63] hover:text-[#e91e63]"
                      }`}
                    >
                      <HeartIcon filled={isWishlisted} />
                    </button>
                  </div>

                  {numericPrice !== null && (
                    <button
                      type="button"
                      onClick={handleBuyNow}
                      className="w-full h-11 sm:h-12 bg-[#e91e63] hover:bg-[#c2185b] active:scale-[0.99] text-white text-xs sm:text-sm font-semibold uppercase tracking-wider rounded-lg transition-all whitespace-nowrap"
                    >
                      Buy now
                    </button>
                  )}
                </div>

                <div className="mt-6 pt-4 border-t border-[#e9ecef] space-y-3 text-xs sm:text-sm">
                  {tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-[#212529] mr-1">Tags:</span>
                      {tags.map((tag) => (
                        <Link
                          key={tag.slug}
                          href={`/shop?tag=${tag.slug}`}
                          className="h-7 px-2.5 inline-flex items-center bg-[#f8f9fa] border border-[#e9ecef] rounded-full text-[11px] text-[#495057] hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
                        >
                          {tag.name}
                        </Link>
                      ))}
                    </div>
                  )}

                  <div className="pt-1">
                    <ShareButtons title={product.name} />
                  </div>
                </div>

                <InfoAccordion items={infoItems} />
              </div>
            </div>
          </section>

          {related.length > 0 && (
            <section className="bg-[#f8f9fa] border-t border-[#e9ecef] py-10 sm:py-12">
              <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
                <h2 className="text-xl sm:text-2xl font-bold text-[#212529] mb-6">
                  Related products
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
                  {related.map((p) => (
                    <RelatedCard key={p.id} product={p} />
                  ))}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Strictly docked mobile bottom sticky action bar */}
      {!loading && !error && product && numericPrice !== null && (
        <div
          style={{ position: "fixed", bottom: 0, left: 0, width: "100%", margin: 0, zIndex: 9999 }}
          className="lg:hidden bg-[#ffffff] border-t border-[#dee2e6] shadow-[0_-4px_16px_rgba(33,37,41,0.1)] px-4 py-2.5 flex items-center justify-between gap-2.5"
        >
          <div className="min-w-0">
            <p className="text-[11px] text-[#6c757d] truncate">{product.name}</p>
            <p className="text-sm font-bold text-[#212529]">{formatKD(numericPrice)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleAddToCart}
              className="h-10 px-3.5 border border-[#212529] bg-[#ffffff] text-[#212529] text-[11px] font-semibold uppercase rounded-lg whitespace-nowrap"
            >
              Add cart
            </button>
            <button
              type="button"
              onClick={handleBuyNow}
              className="h-10 px-4 bg-[#e91e63] text-[#ffffff] text-[11px] font-semibold uppercase rounded-lg whitespace-nowrap"
            >
              Buy now
            </button>
          </div>
        </div>
      )}

      <div
        aria-live="polite"
        className={`fixed bottom-24 lg:bottom-6 right-4 sm:right-6 z-[10000] max-w-[280px] bg-[#212529] text-white text-sm font-medium px-4 py-3 rounded-lg shadow-xl flex items-center gap-2.5 transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0 pointer-events-none"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#e91e63] shrink-0" />
        <span className="line-clamp-1">{toast ?? ""}</span>
      </div>
    </div>
  );
}