// app/page.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCart, formatKD, type CartItem } from "@/lib/cart";
import { WISHLIST_EVENT, readWishlist, toggleWishlist } from "@/lib/wishlist";
import { EXPRESS_BUY_NOW_KEY } from "@/app/product/[slug]/product-client";
import ProtectedProductImage from "@/components/protected-product-image";

/* ============================================================
   TYPES
   ============================================================ */
interface GraphQLCategory {
  id?: string;
  databaseId?: number;
  name: string;
  slug?: string;
}

interface GraphQLProduct {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  price: string | null;
  regularPrice: string | null;
  stockStatus?: string | null;
  image: { sourceUrl: string } | null;
  productCategories: { nodes: GraphQLCategory[] } | null;
}

interface GraphQLResponse {
  data?: {
    products?: {
      nodes: GraphQLProduct[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface HeroSlide {
  id: number;
  desktopSrc: string;
  mobileSrc: string;
  alt: string;
}

interface HotCard {
  id: number;
  eyebrow: string;
  title: string[];
  path: string;
  src: string;
  bg: string;
}

interface PromoTile {
  id: number;
  title: string;
  path: string;
  src: string;
}

interface VideoTile {
  id: number;
  title: string;
  path: string;
  src: string;
}

/* ============================================================
   CONSTANTS
   ============================================================ */
const API_URL: string =
  process.env.NEXT_PUBLIC_WORDPRESS_API_URL || "https://backend.shophope.online/graphql";

const PRODUCTS_QUERY: string = `
  query GetProducts {
    products(first: 16) {
      nodes {
        id
        databaseId
        name
        slug
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
            id
            databaseId
            name
            slug
          }
        }
      }
    }
  }
`;

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 1,
    desktopSrc: "/banner-shop-hope-3.png",
    mobileSrc: "/mobile-banner-2.png",
    alt: "Beauty, Bold & Beyond — Shop & Hope Kuwait",
  },
  {
    id: 2,
    desktopSrc: "/banner-shop-hope-1.jpg",
    mobileSrc: "/mobile-banner-2.png",
    alt: "Essential Comfort, Everyday Elegance",
  },
  {
    id: 3,
    desktopSrc: "/banner-shop-hope-3.png",
    mobileSrc: "/banner-shop-hope-1.jpg",
    alt: "New Arrivals Collection in Kuwait",
  },
];

const HOT_CARDS: HotCard[] = [
  {
    id: 1,
    eyebrow: "Hot list",
    title: ["Summer", "Men's Wear"],
    path: "/category/mens-wear",
    src: "/fashion-flat-baner-1.jpg",
    bg: "#f8f9fa",
  },
  {
    id: 2,
    eyebrow: "Category",
    title: ["Special", "Footwear"],
    path: "/category/special-shoes",
    src: "/fashion-flat-baner-2.jpg",
    bg: "#f8f9fa",
  },
  {
    id: 3,
    eyebrow: "Women's",
    title: ["Bags &", "Handbags"],
    path: "/category/bags-handbags",
    src: "/fashion-flat-baner-3.jpg",
    bg: "#f8f9fa",
  },
  {
    id: 4,
    eyebrow: "Seasonal",
    title: ["Women's", "Mid-Season"],
    path: "/category/womens-wear",
    src: "/fashion-flat-baner-4.jpg",
    bg: "#f8f9fa",
  },
];

const PROMO_TILES: PromoTile[] = [
  {
    id: 1,
    title: "Essential Comfort, Everyday Style",
    path: "/category/lingerie-sleepwear",
    src: "/baneney-d7.png",
  },
  {
    id: 2,
    title: "Glow Like Never Before",
    path: "/category/beauty",
    src: "/banner-7474.png",
  },
  {
    id: 3,
    title: "Unveil Your Style — Women's Handbag Collection",
    path: "/category/bags-handbags",
    src: "/banner-22-bags.png",
  },
];

const VIDEO_TILES: VideoTile[] = [
  { id: 1, title: "Luggages & Trolleys", path: "/category/luggages-trolleys", src: "/1.mp4" },
  { id: 2, title: "Backpacks", path: "/category/backpacks", src: "/2.mp4" },
  { id: 3, title: "Lingerie & Sleepwear", path: "/category/lingerie-sleepwear", src: "/4.mp4" },
  { id: 4, title: "Western Wear", path: "/category/western-wear", src: "/3.mp4" },
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

function getDiscountPercent(price: string | null, regularPrice: string | null): number | null {
  const current = parseAmount(price);
  const regular = parseAmount(regularPrice);
  if (current === null || regular === null || regular <= current) return null;
  return Math.round(((regular - current) / regular) * 100);
}

/* ============================================================
   ICONS
   ============================================================ */
function HeartIcon({ filled = false }: { filled?: boolean }): ReactNode {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" | "up" }): ReactNode {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === "left" && <path d="m15 18-6-6 6-6" />}
      {direction === "right" && <path d="m9 18 6-6-6-6" />}
      {direction === "up" && <path d="m18 15-6-6-6 6" />}
    </svg>
  );
}

/* ============================================================
   HERO CAROUSEL
   ============================================================ */
function HeroCarousel(): ReactNode {
  const [index, setIndex] = useState<number>(0);
  const [failedIds, setFailedIds] = useState<number[]>([]);

  const slides: HeroSlide[] = HERO_SLIDES.filter((s) => !failedIds.includes(s.id));
  const activeIndex: number = slides.length > 0 ? index % slides.length : 0;

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const goTo = (target: number): void => {
    if (slides.length === 0) return;
    setIndex((target + slides.length) % slides.length);
  };

  const markFailed = (id: number): void => {
    setFailedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  if (slides.length === 0) {
    return (
      <section
        className="w-full h-[220px] sm:h-[340px] lg:h-[460px] bg-[#f8f9fa] border-b border-[#e9ecef]"
        aria-hidden="true"
      />
    );
  }

  return (
    <section
      className="relative w-full overflow-hidden bg-[#162447] h-[220px] sm:h-[340px] lg:h-[460px]"
      aria-roledescription="carousel"
      aria-label="Promotions"
    >
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {slides.map((slide) => (
          <div key={slide.id} className="relative min-w-full h-full">
            <picture className="w-full h-full block">
              <source media="(max-width: 639px)" srcSet={slide.mobileSrc} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.desktopSrc}
                alt={slide.alt}
                onError={() => markFailed(slide.id)}
                className="w-full h-full object-cover object-center select-none"
                draggable={false}
              />
            </picture>
          </div>
        ))}
      </div>

      <Link href="/shop" aria-label="Shop collection" className="absolute inset-0 z-10 cursor-pointer">
        <span className="sr-only">Shop collection</span>
      </Link>

      {slides.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous slide"
            onClick={() => goTo(activeIndex - 1)}
            className="hidden sm:flex absolute z-20 left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 text-[#212529] border border-[#e9ecef] shadow items-center justify-center transition-colors hover:bg-[#e91e63] hover:text-white hover:border-[#e91e63] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => goTo(activeIndex + 1)}
            className="hidden sm:flex absolute z-20 right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 text-[#212529] border border-[#e9ecef] shadow items-center justify-center transition-colors hover:bg-[#e91e63] hover:text-white hover:border-[#e91e63] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
          >
            <ChevronIcon direction="right" />
          </button>

          <div className="absolute z-20 bottom-3.5 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === activeIndex}
                onClick={() => goTo(i)}
                className={`h-2 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] ${
                  i === activeIndex ? "w-6 bg-[#e91e63]" : "w-2 bg-white/80 hover:bg-white"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

/* ============================================================
   HOT LIST
   ============================================================ */
function HotList(): ReactNode {
  return (
    <section className="bg-white pt-6 pb-6 sm:pb-8" aria-label="Featured collections">
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {HOT_CARDS.map((card) => (
            <div
              key={card.id}
              className="relative overflow-hidden rounded-xl min-h-[195px] sm:h-[225px] w-full border border-[#e9ecef] shadow-[0_1px_4px_rgba(33,37,41,0.04)]"
              style={{ backgroundColor: card.bg }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.src}
                alt=""
                aria-hidden="true"
                className="absolute right-0 top-0 h-full w-[60%] object-cover object-center select-none pointer-events-none"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-transparent pointer-events-none"
              />

              <div className="relative z-10 h-full px-5 py-5 flex flex-col items-start justify-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#6c757d]">
                  {card.eyebrow}
                </span>
                <h2 className="mt-1.5 text-[22px] sm:text-[24px] leading-[1.16] font-bold text-[#212529]">
                  {card.title.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </h2>
                <Link
                  href={card.path}
                  className="mt-4 inline-flex items-center justify-center h-9 px-4 bg-[#212529] hover:bg-[#e91e63] text-white text-[11px] font-semibold uppercase tracking-wider rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
                >
                  Explore
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PRODUCT CARD
   ============================================================ */
interface ProductCardProps {
  product: GraphQLProduct;
  isWishlisted: boolean;
  onToggleWishlist: (product: GraphQLProduct) => void;
  onAdd: (product: GraphQLProduct) => void;
  onBuyNow: (product: GraphQLProduct) => void;
}

function ProductCard({
  product,
  isWishlisted,
  onToggleWishlist,
  onAdd,
  onBuyNow,
}: ProductCardProps): ReactNode {
  const categoryName: string = product.productCategories?.nodes?.[0]?.name ?? "Featured";
  const discount: number | null = getDiscountPercent(product.price, product.regularPrice);
  const priceNum: number | null = parseAmount(product.price);
  const regularNum: number | null = parseAmount(product.regularPrice);
  const isOutOfStock: boolean = product.stockStatus === "OUT_OF_STOCK";
  const productHref: string = `/product/${product.slug}`;

  return (
    <article className="group relative flex flex-col h-full bg-white rounded-xl border border-[#e9ecef] overflow-hidden shadow-[0_1px_4px_rgba(33,37,41,0.04)] hover:border-[#dee2e6] hover:shadow-[0_10px_24px_rgba(33,37,41,0.08)] transition-all duration-200">
      {discount !== null && (
        <span className="absolute top-2.5 left-2.5 z-10 bg-[#e91e63] text-white text-[11px] font-bold px-2 py-0.5 rounded-md">
          {`-${discount}%`}
        </span>
      )}

      <div className="relative p-2.5 sm:p-3 pb-0">
        <Link
          href={productHref}
          aria-label={product.name}
          className="block w-full aspect-square rounded-lg overflow-hidden bg-[#f8f9fa]"
        >
          <ProtectedProductImage
            src={product.image?.sourceUrl}
            alt={product.name}
            imgClassName="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        <button
          type="button"
          onClick={() => onToggleWishlist(product)}
          aria-pressed={isWishlisted}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute top-4 right-4 z-10 w-8 h-8 inline-flex items-center justify-center rounded-full border shadow-sm transition-colors ${
            isWishlisted
              ? "bg-[#e91e63] text-white border-[#e91e63]"
              : "bg-white/95 text-[#212529] border-[#e9ecef] hover:text-[#e91e63]"
          }`}
        >
          <HeartIcon filled={isWishlisted} />
        </button>
      </div>

      <div className="flex flex-col flex-1 p-3 sm:p-4 gap-1">
        <p className="text-[11px] font-medium text-[#6c757d] truncate">{categoryName}</p>

        <Link
          href={productHref}
          title={product.name}
          className="line-clamp-2 min-h-[36px] sm:min-h-[40px] text-[13px] sm:text-[14.5px] font-semibold leading-snug text-[#212529] hover:text-[#e91e63] transition-colors"
        >
          {product.name}
        </Link>

        {product.stockStatus && (
          <p
            className={`text-[11px] font-medium ${
              isOutOfStock ? "text-[#dc3545]" : "text-[#198754]"
            }`}
          >
            {isOutOfStock ? "Out of stock" : "In stock"}
          </p>
        )}

        <div className="mt-auto pt-2.5 flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-1.5">
            {priceNum !== null ? (
              <span className="text-[14px] sm:text-[16px] font-bold text-[#212529]">
                {formatKD(priceNum)}
              </span>
            ) : (
              <span className="text-xs font-semibold text-[#6c757d]">Select options</span>
            )}
            {discount !== null && regularNum !== null && (
              <span className="text-[11.5px] sm:text-[12.5px] text-[#6c757d] line-through">
                {formatKD(regularNum)}
              </span>
            )}
          </div>

          {isOutOfStock || priceNum === null ? (
            <Link
              href={productHref}
              className="h-10 w-full inline-flex items-center justify-center rounded-lg bg-[#212529] hover:bg-[#343a40] text-white text-[11px] sm:text-[12px] font-semibold uppercase tracking-wide transition-colors"
            >
              View product
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => onAdd(product)}
                className="h-10 border border-[#212529] bg-white hover:bg-[#f8f9fa] active:scale-[0.98] text-[#212529] text-[11px] sm:text-[12px] font-semibold uppercase rounded-lg transition-all"
              >
                Add cart
              </button>
              <button
                type="button"
                onClick={() => onBuyNow(product)}
                className="h-10 bg-[#e91e63] hover:bg-[#c2185b] active:scale-[0.98] text-white text-[11px] sm:text-[12px] font-semibold uppercase rounded-lg transition-all"
              >
                Buy now
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   CATEGORY-WISE PRODUCTS SHOWCASE
   ============================================================ */
interface FeaturedProductsProps {
  products: GraphQLProduct[];
  loading: boolean;
  error: string | null;
  wishlist: string[];
  onRetry: () => void;
  onAdd: (product: GraphQLProduct) => void;
  onBuyNow: (product: GraphQLProduct) => void;
  onToggleWishlist: (product: GraphQLProduct) => void;
}

function FeaturedProducts({
  products,
  loading,
  error,
  wishlist,
  onRetry,
  onAdd,
  onBuyNow,
  onToggleWishlist,
}: FeaturedProductsProps): ReactNode {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const categoryTabs: string[] = useMemo(() => {
    const names = new Set<string>();
    products.forEach((p) => {
      (p.productCategories?.nodes ?? []).forEach((c) => {
        if (c.name && c.name.toLowerCase() !== "uncategorized") {
          names.add(c.name);
        }
      });
    });
    return ["ALL", ...Array.from(names).slice(0, 6)];
  }, [products]);

  const visibleProducts: GraphQLProduct[] = useMemo(() => {
    const list =
      selectedCategory === "ALL"
        ? products
        : products.filter((p) =>
            (p.productCategories?.nodes ?? []).some(
              (c) => c.name.toLowerCase() === selectedCategory.toLowerCase()
            )
          );
    return list.slice(0, 8);
  }, [products, selectedCategory]);

  return (
    <section className="bg-white py-8 sm:py-10" aria-labelledby="featured-title">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 mb-5 border-b border-[#e9ecef]">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#e91e63]">
              Shop &amp; Hope Kuwait
            </p>
            <h2
              id="featured-title"
              className="mt-1 text-2xl sm:text-3xl font-bold text-[#212529] tracking-tight"
            >
              Featured selection
            </h2>
          </div>

          <Link
            href="/shop"
            className="inline-flex h-10 px-4 items-center justify-center rounded-lg border border-[#dee2e6] bg-white hover:border-[#e91e63] text-[#212529] hover:text-[#e91e63] text-xs font-semibold uppercase tracking-wide transition-colors w-fit"
          >
            View all products
          </Link>
        </div>

        {!loading && !error && categoryTabs.length > 1 && (
          <div
            role="tablist"
            aria-label="Product categories"
            className="mb-6 flex items-center gap-2 overflow-x-auto pb-1"
          >
            {categoryTabs.map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setSelectedCategory(cat)}
                  className={`h-9 shrink-0 px-4 rounded-full text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[#212529] text-white"
                      : "bg-[#f8f9fa] text-[#495057] border border-[#e9ecef] hover:border-[#e91e63] hover:text-[#e91e63]"
                  }`}
                >
                  {cat === "ALL" ? "All items" : cat}
                </button>
              );
            })}
          </div>
        )}

        <div>
          {loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[340px] sm:h-[400px] rounded-xl bg-[#f8f9fa] border border-[#e9ecef] animate-pulse"
                />
              ))}
            </div>
          )}

          {!loading && error && (
            <div
              role="alert"
              className="max-w-xl mx-auto text-center border border-[#e9ecef] p-8 bg-[#f8f9fa] rounded-xl"
            >
              <p className="font-bold text-[#212529]">We couldn&apos;t load products.</p>
              <p className="mt-1 text-sm text-[#6c757d]">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-5 bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-lg transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && visibleProducts.length === 0 && (
            <div className="text-center py-10 bg-[#f8f9fa] border border-[#e9ecef] rounded-xl">
              <p className="text-sm text-[#495057]">No products found in this category right now.</p>
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className="mt-4 h-10 px-5 bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-semibold uppercase tracking-wide rounded-lg transition-colors"
              >
                Show all items
              </button>
            </div>
          )}

          {!loading && !error && visibleProducts.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {visibleProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isWishlisted={wishlist.includes(product.id)}
                  onToggleWishlist={onToggleWishlist}
                  onAdd={onAdd}
                  onBuyNow={onBuyNow}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   TRENDING PROMO TILES
   ============================================================ */
function TrendingSection(): ReactNode {
  return (
    <section
      className="bg-[#f8f9fa] py-10 sm:py-12 border-y border-[#e9ecef]"
      aria-labelledby="trending-title"
    >
      <div className="w-full max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-7">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#6c757d]">
              Curated edits
            </p>
            <h2
              id="trending-title"
              className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#212529]"
            >
              Trending collections
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {PROMO_TILES.map((tile) => (
            <Link
              key={tile.id}
              href={tile.path}
              aria-label={tile.title}
              className="group block w-full aspect-[4/3] overflow-hidden rounded-xl bg-white border border-[#e9ecef] shadow-[0_1px_4px_rgba(33,37,41,0.04)] hover:shadow-[0_10px_24px_rgba(33,37,41,0.08)] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tile.src}
                alt={tile.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   VIDEO SECTION
   ============================================================ */
function VideoSection(): ReactNode {
  return (
    <section className="bg-white py-10 sm:py-12" aria-labelledby="video-title">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-wider text-[#6c757d]">
            Shop by style
          </p>
          <h2
            id="video-title"
            className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#212529]"
          >
            Featured reels
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {VIDEO_TILES.map((tile) => (
            <div
              key={tile.id}
              className="flex flex-col rounded-xl border border-[#e9ecef] bg-white overflow-hidden shadow-[0_1px_4px_rgba(33,37,41,0.04)]"
            >
              <div className="relative w-full aspect-[388/607] overflow-hidden bg-[#f8f9fa]">
                <video
                  src={tile.src}
                  className="absolute inset-0 w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={tile.title}
                />
              </div>

              <div className="p-3 sm:p-4 flex flex-col items-start gap-2.5">
                <h3 className="w-full text-xs sm:text-sm font-semibold text-[#212529] truncate">
                  {tile.title}
                </h3>

                <Link
                  href={tile.path}
                  className="inline-flex items-center justify-center h-9 px-4 bg-[#212529] hover:bg-[#e91e63] text-white text-[11px] font-semibold uppercase tracking-wide rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
                >
                  Shop collection
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   PAGE
   ============================================================ */
export default function HomePage(): ReactNode {
  const router = useRouter();
  const [products, setProducts] = useState<GraphQLProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  useEffect(() => {
    const onScroll = (): void => setShowScrollTop(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sync = (): void => setWishlist(readWishlist().map((i) => i.id));
    sync();
    window.addEventListener(WISHLIST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WISHLIST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts(): Promise<void> {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: PRODUCTS_QUERY }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`GraphQL request failed with status ${res.status}`);
        }

        const json: GraphQLResponse = await res.json();

        if (json.errors && json.errors.length > 0) {
          throw new Error(json.errors[0].message);
        }

        setProducts(json.data?.products?.nodes ?? []);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load products.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadProducts();
    return () => controller.abort();
  }, [reloadKey]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleAddToCart = (product: GraphQLProduct): void => {
    addToCart({
      id: String(product.databaseId),
      slug: product.slug,
      name: product.name,
      image: product.image?.sourceUrl ?? null,
      price: parseAmount(product.price) ?? 0,
    });
    setToast(`Added: ${product.name}`);
  };

  const handleBuyNow = (product: GraphQLProduct): void => {
    const price = parseAmount(product.price);
    if (price === null) return;
    const expressItem: CartItem = {
      id: String(product.databaseId),
      slug: product.slug,
      name: product.name,
      image: product.image?.sourceUrl ?? null,
      price,
      quantity: 1,
    };
    try {
      sessionStorage.setItem(EXPRESS_BUY_NOW_KEY, JSON.stringify(expressItem));
    } catch {
      addToCart({
        id: expressItem.id,
        slug: expressItem.slug,
        name: expressItem.name,
        image: expressItem.image,
        price: expressItem.price,
      });
    }
    router.push("/checkout?mode=buy_now");
  };

  const handleToggleWishlist = (product: GraphQLProduct): void => {
    const added: boolean = toggleWishlist({
      id: product.id,
      slug: product.slug,
      name: product.name,
      image: product.image?.sourceUrl ?? null,
      price: parseAmount(product.price) ?? 0,
    });
    setToast(added ? "Added to wishlist" : "Removed from wishlist");
  };

  return (
    <>
      <HeroCarousel />
      <HotList />
      <FeaturedProducts
        products={products}
        loading={loading}
        error={error}
        wishlist={wishlist}
        onRetry={() => setReloadKey((k) => k + 1)}
        onAdd={handleAddToCart}
        onBuyNow={handleBuyNow}
        onToggleWishlist={handleToggleWishlist}
      />
      <TrendingSection />
      <VideoSection />

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 w-10 h-10 rounded-full bg-white border border-[#dee2e6] text-[#212529] hover:bg-[#e91e63] hover:text-white hover:border-[#e91e63] shadow-md inline-flex items-center justify-center transition-colors"
        >
          <ChevronIcon direction="up" />
        </button>
      )}

      <div
        aria-live="polite"
        className={`fixed bottom-20 md:bottom-6 left-4 sm:left-auto sm:right-6 z-[60] max-w-[280px] bg-[#212529] text-white text-sm font-medium px-4 py-3 rounded-lg shadow-xl flex items-center gap-2.5 transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0 pointer-events-none"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#e91e63] shrink-0" />
        <span className="line-clamp-1">{toast ?? ""}</span>
      </div>
    </>
  );
}