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
  process.env.NEXT_PUBLIC_WORDPRESS_API_URL || "http://localhost/shophope/graphql";

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
    alt: "BEAUTY, BOLD & BEYOND — Shop & Hope Kuwait",
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
    bg: "#f4f4f4",
  },
  {
    id: 2,
    eyebrow: "Category",
    title: ["Fantastic", "Special Shoes"],
    path: "/category/special-shoes",
    src: "/fashion-flat-baner-2.jpg",
    bg: "#f4f4f4",
  },
  {
    id: 3,
    eyebrow: "Women's",
    title: ["Bags &", "Handbags"],
    path: "/category/bags-handbags",
    src: "/fashion-flat-baner-3.jpg",
    bg: "#f4f4f4",
  },
  {
    id: 4,
    eyebrow: "Summertime",
    title: ["Women's", "Mid-Season"],
    path: "/category/womens-wear",
    src: "/fashion-flat-baner-4.jpg",
    bg: "#f4f4f4",
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
    title: "Unveil Your Style - Women's Handbag Collection",
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    return <section className="w-full min-h-[210px] sm:min-h-[300px] lg:h-[460px] bg-[#f8f9fa]" aria-hidden="true" />;
  }

  return (
    <section
      className="relative w-full overflow-hidden bg-[#162447] min-h-[210px] sm:min-h-[300px] lg:h-[460px]"
      aria-roledescription="carousel"
      aria-label="Promotions"
    >
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {slides.map((slide) => (
          <div key={slide.id} className="relative min-w-full h-full flex items-center justify-center">
            <picture className="w-full h-full flex items-center justify-center">
              <source media="(max-width: 639px)" srcSet={slide.mobileSrc} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.desktopSrc}
                alt={slide.alt}
                onError={() => markFailed(slide.id)}
                className="w-full h-full object-contain sm:object-cover object-center select-none"
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
            className="hidden sm:flex absolute z-20 left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 text-[#212529] shadow items-center justify-center transition-colors hover:bg-[#e91e63] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
          >
            <ChevronIcon direction="left" />
          </button>
          <button
            type="button"
            aria-label="Next slide"
            onClick={() => goTo(activeIndex + 1)}
            className="hidden sm:flex absolute z-20 right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 text-[#212529] shadow items-center justify-center transition-colors hover:bg-[#e91e63] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
          >
            <ChevronIcon direction="right" />
          </button>

          <div className="absolute z-20 bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === activeIndex}
                onClick={() => goTo(i)}
                className={`h-2.5 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] ${
                  i === activeIndex ? "w-7 bg-[#e91e63]" : "w-2.5 bg-white/80 hover:bg-white"
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
    <section className="bg-white pt-5 pb-6 sm:pb-8" aria-label="Hot list">
      <div className="w-full max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {HOT_CARDS.map((card) => (
            <div
              key={card.id}
              className="relative overflow-hidden rounded-lg min-h-[205px] sm:h-[235px] w-full border border-[#f1f5f9]"
              style={{ backgroundColor: card.bg }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.src}
                alt=""
                aria-hidden="true"
                className="absolute right-0 top-0 h-full w-[62%] object-cover object-center select-none pointer-events-none"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-r from-white via-white/90 to-transparent pointer-events-none"
              />

              <div className="relative z-10 h-full px-6 py-6 flex flex-col items-start justify-center">
                <span className="text-[13px] leading-none font-medium text-[#6c757d]">{card.eyebrow}</span>
                <h3 className="mt-2.5 text-[24px] sm:text-[26px] leading-[1.18] font-semibold text-[#212529]">
                  {card.title.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </h3>
                <Link
                  href={card.path}
                  className="mt-4 inline-flex items-center justify-center h-[40px] px-5 bg-[#e91e63] hover:bg-[#c2185b] text-white text-[12px] font-semibold uppercase tracking-wide rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
                >
                  SEE MORE
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
  const categoryName: string = product.productCategories?.nodes?.[0]?.name ?? "Uncategorized";
  const discount: number | null = getDiscountPercent(product.price, product.regularPrice);
  const priceNum: number | null = parseAmount(product.price);
  const regularNum: number | null = parseAmount(product.regularPrice);
  const isOutOfStock: boolean = product.stockStatus === "OUT_OF_STOCK";
  const productHref: string = `/product/${product.slug}`;

  return (
    <article className="group relative flex flex-col h-full bg-white rounded-xl border border-[#e9ecef] overflow-hidden shadow-[0_2px_10px_rgba(33,37,41,0.05)] hover:shadow-[0_10px_28px_rgba(33,37,41,0.12)] transition-shadow duration-300">
      {discount !== null && (
        <span className="absolute top-2.5 left-2.5 z-10 bg-[#e91e63] text-white text-[11px] sm:text-[12px] font-bold px-2.5 py-1 rounded-full shadow">
          {`-${discount}%`}
        </span>
      )}

      <div className="relative p-2.5 sm:p-3.5 pb-0">
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
          className={`absolute top-4 right-4 sm:top-5 sm:right-5 z-10 w-8 h-8 sm:w-9 sm:h-9 inline-flex items-center justify-center rounded-full border border-[#f1f5f9] shadow-sm transition-colors ${
            isWishlisted ? "bg-[#e91e63] text-white border-[#e91e63]" : "bg-white text-[#212529] hover:text-[#e91e63]"
          }`}
        >
          <HeartIcon filled={isWishlisted} />
        </button>
      </div>

      <div className="flex flex-col flex-1 p-3 sm:p-4 gap-1.5">
        <Link
          href={productHref}
          title={product.name}
          className="line-clamp-2 min-h-[38px] sm:min-h-[42px] text-[13px] sm:text-[15px] font-semibold leading-snug text-[#212529] hover:text-[#e91e63] transition-colors"
        >
          {product.name}
        </Link>

        <p className="text-[11px] sm:text-[12px] text-[#6c757d] truncate">{categoryName}</p>

        {product.stockStatus && (
          <p
            className={`text-[11px] sm:text-[12px] font-semibold ${
              isOutOfStock ? "text-[#dc3545]" : "text-[#198754]"
            }`}
          >
            {isOutOfStock ? "Out of stock" : "✓ In stock"}
          </p>
        )}

        <div className="mt-auto pt-2 flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline gap-1.5">
            {priceNum !== null ? (
              <span className="text-[14px] sm:text-[16px] font-bold text-[#e91e63]">{formatKD(priceNum)}</span>
            ) : (
              <span className="text-xs font-semibold text-[#6c757d]">Select options</span>
            )}
            {discount !== null && regularNum !== null && (
              <span className="text-[11px] sm:text-[13px] text-[#6c757d] line-through">{formatKD(regularNum)}</span>
            )}
          </div>

          {isOutOfStock || priceNum === null ? (
            <Link
              href={productHref}
              className="h-10 sm:h-11 w-full inline-flex items-center justify-center rounded-md bg-[#212529] hover:bg-[#343a40] text-white text-[11px] sm:text-[12px] font-bold uppercase tracking-wide transition-colors"
            >
              View Product
            </Link>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => onAdd(product)}
                className="h-9 sm:h-10 border border-[#e91e63] bg-white hover:bg-[#fff5f8] active:scale-[0.98] text-[#e91e63] text-[11px] sm:text-[12px] font-bold uppercase rounded-md transition-all"
              >
                Add Cart
              </button>
              <button
                type="button"
                onClick={() => onBuyNow(product)}
                className="h-9 sm:h-10 bg-[#e91e63] hover:bg-[#c2185b] active:scale-[0.98] text-white text-[11px] sm:text-[12px] font-bold uppercase rounded-md transition-all"
              >
                Buy Now
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
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-wider text-[#e91e63]">
              Welcome to Shop &amp; Hope
            </p>
            <h2 id="featured-title" className="mt-1 text-2xl sm:text-3xl lg:text-[36px] font-bold text-[#212529] tracking-tight">
              Category-Wise Picks
            </h2>
          </div>

          <Link
            href="/shop"
            className="inline-flex h-10 px-5 items-center justify-center rounded-full bg-[#fff5f8] hover:bg-[#e91e63] text-[#e91e63] hover:text-white text-[12px] sm:text-[13px] font-bold transition-colors w-fit"
          >
            More Products &gt;
          </Link>
        </div>

        {!loading && !error && categoryTabs.length > 1 && (
          <div
            role="tablist"
            aria-label="Product categories"
            className="mb-6 flex items-center gap-2 overflow-x-auto pb-2"
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
                  className={`h-9 shrink-0 px-4 rounded-full text-[12px] font-semibold uppercase tracking-wide transition-colors ${
                    active
                      ? "bg-[#e91e63] text-white"
                      : "bg-[#f8f9fa] text-[#212529] border border-[#dee2e6] hover:border-[#e91e63] hover:text-[#e91e63]"
                  }`}
                >
                  {cat === "ALL" ? "All Products" : cat}
                </button>
              );
            })}
          </div>
        )}

        <div>
          {loading && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[360px] sm:h-[420px] rounded-xl bg-[#f8f9fa] border border-[#f1f5f9] animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="max-w-xl mx-auto text-center border border-[#f1f5f9] p-8 bg-[#f8f9fa] rounded-xl">
              <p className="font-bold text-[#212529]">We couldn&apos;t load products.</p>
              <p className="mt-1 text-sm text-[#6c757d]">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-5 bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-full transition-colors"
              >
                RETRY
              </button>
            </div>
          )}

          {!loading && !error && visibleProducts.length === 0 && (
            <div className="text-center py-10 bg-[#f8f9fa] border border-[#f1f5f9] rounded-xl">
              <p className="text-[#6c757d]">No products found in this category right now.</p>
              <button
                type="button"
                onClick={() => setSelectedCategory("ALL")}
                className="mt-4 h-10 px-6 bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-bold uppercase rounded-md transition-colors"
              >
                Show All Products
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
    <section className="bg-[#f8f9fa] py-10 sm:py-12 border-y border-[#f1f5f9]" aria-labelledby="trending-title">
      <div className="w-full max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
        <div className="text-center mb-8">
          <p className="text-[14px] font-medium text-[#6c757d]">Top Trending Products</p>
          <h2 id="trending-title" className="mt-2 text-2xl sm:text-3xl lg:text-[38px] font-bold tracking-tight text-[#212529]">
            Trending Now: Must-Have Picks
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {PROMO_TILES.map((tile) => (
            <Link
              key={tile.id}
              href={tile.path}
              aria-label={tile.title}
              className="group block w-full aspect-[4/3] overflow-hidden rounded-xl bg-white border border-[#f1f5f9] shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
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
    <section className="bg-white py-10 sm:py-12" aria-label="Video collections">
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
        <div className="text-center mb-8">
          <p className="text-[14px] font-medium text-[#6c757d]">Shop By Style</p>
          <h2 className="mt-2 text-2xl sm:text-3xl lg:text-[36px] font-bold tracking-tight text-[#212529]">
            Featured Video Collections
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {VIDEO_TILES.map((tile) => (
            <div key={tile.id} className="flex flex-col items-center text-center rounded-xl border border-[#e9ecef] bg-white overflow-hidden pb-4">
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

              <h3 className="mt-3 px-2.5 w-full text-[13px] sm:text-[15px] font-semibold text-[#212529] truncate">
                {tile.title}
              </h3>

              <Link
                href={tile.path}
                className="mt-2.5 inline-flex items-center justify-center h-9 sm:h-10 px-5 sm:px-7 bg-[#e91e63] hover:bg-[#c2185b] text-white text-[11px] sm:text-[12px] font-semibold uppercase tracking-wide rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
              >
                Shop Now
              </Link>
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
        className={`fixed bottom-20 md:bottom-6 left-4 sm:left-auto sm:right-6 z-[60] max-w-[280px] bg-[#212529] text-white text-sm font-medium px-5 py-3 rounded-lg shadow-xl flex items-center gap-2 transition-all duration-300 ${
          toast ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0 pointer-events-none"
        }`}
      >
        <span className="w-2 h-2 rounded-full bg-[#e91e63] shrink-0" />
        <span className="line-clamp-1">{toast ?? ""}</span>
      </div>
    </>
  );
}