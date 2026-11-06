// app/page.tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { addToCart } from "@/lib/cart";
import { WISHLIST_EVENT, readWishlist, toggleWishlist } from "@/lib/wishlist";

/* ============================================================
   TYPES
   ============================================================ */
interface GraphQLProduct {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  price: string;
  regularPrice: string | null;
  image: { sourceUrl: string } | null;
  productCategories: { nodes: Array<{ name: string }> } | null;
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
  src: string;
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
        image {
          sourceUrl
        }
        productCategories {
          nodes {
            name
          }
        }
      }
    }
  }
`;

/* All image paths point to files inside public/ (extension must match exactly) */
const HERO_SLIDES: HeroSlide[] = [
  { id: 1, src: "/mobile-banner-2.png", alt: "BEAUTY, BOLD & BEYOND" },
  { id: 2, src: "/banner-shop-hope-3.png", alt: "Essential Comfort, Everyday Elegance" },
  { id: 3, src: "/banner-shop-hope-1.jpg", alt: "SPRING SUMMER, COLLECTION" },
];

/* Hot list: exact photos from public/ (all fashion-flat-baner files are .jpg) */
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

/* Trending: 3 promo banners (text and SHOP NOW button are already inside the images) */
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

/* Video section: 4 videos from public/ (1.mp4, 2.mp4, 3.mp4, 4.mp4) */
const VIDEO_TILES: VideoTile[] = [
  { id: 1, title: "Luggages & Trolleys", path: "/category/luggages-trolleys", src: "/1.mp4" },
  { id: 2, title: "Backpacks", path: "/category/backpacks", src: "/2.mp4" },
  { id: 3, title: "Lingerie & Sleepwear", path: "/category/lingerie-sleepwear", src: "/4.mp4" },
  { id: 4, title: "Western Wear", path: "/category/western-wear", src: "/3.mp4" },
];

/* ============================================================
   HELPERS
   ============================================================ */

/** WooCommerce prices come as formatted HTML. Convert them to plain text. */
function htmlToText(html: string): string {
  if (typeof window === "undefined") return html.replace(/<[^>]*>/g, "");
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent ?? "";
}

/** Extract the numeric amount from a formatted price string. */
function parseAmount(html: string | null | undefined): number | null {
  if (!html) return null;
  const match = htmlToText(html).match(/\d+(?:[.,]\d+)?/);
  if (!match) return null;
  const value = parseFloat(match[0].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Discount percentage from real price vs regular price. Returns null if not on sale. */
function getDiscountPercent(price: string | null, regularPrice: string | null): number | null {
  const current = parseAmount(price);
  const regular = parseAmount(regularPrice);
  if (current === null || regular === null || regular <= current) return null;
  return Math.round(((regular - current) / regular) * 100);
}

/* ============================================================
   ICONS (inline SVG)
   ============================================================ */
function HeartIcon({ filled = false }: { filled?: boolean }): ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }): ReactNode {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {direction === "left" ? <path d="m15 18-6-6 6-6" /> : <path d="m9 18 6-6-6-6" />}
    </svg>
  );
}

/* ============================================================
   HERO CAROUSEL  (desktop height 460px)
   Slides whose image fails to load are skipped automatically.
   ============================================================ */
function HeroCarousel(): ReactNode {
  const [index, setIndex] = useState<number>(0);
  const [failedIds, setFailedIds] = useState<number[]>([]);

  const slides: HeroSlide[] = HERO_SLIDES.filter((s) => !failedIds.includes(s.id));

  /* Derive a valid index during render, so no effect is needed to correct it */
  const activeIndex: number = slides.length > 0 ? index % slides.length : 0;

  /* Autoplay */
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
    return <section className="w-full h-[220px] sm:h-[300px] lg:h-[460px] bg-[#f8f9fa]" aria-hidden="true" />;
  }

  return (
    <section
      className="relative w-full p-0 m-0 overflow-hidden bg-white h-[220px] sm:h-[300px] lg:h-[460px]"
      aria-roledescription="carousel"
      aria-label="Promotions"
    >
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {slides.map((slide) => (
          <div key={slide.id} className="relative min-w-full h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.src}
              alt={slide.alt}
              onError={() => markFailed(slide.id)}
              className="absolute inset-0 w-full h-full object-cover object-center select-none"
              draggable={false}
            />
          </div>
        ))}
      </div>

      {/* Invisible link over the whole hero, routes to /shop */}
      <Link href="/shop" aria-label="Shop collection" className="absolute inset-0 z-10 cursor-pointer">
        <span className="sr-only">Shop collection</span>
      </Link>

      {slides.length > 1 && (
        <>
          {/* Arrows (above overlay) */}
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

          {/* Dots (above overlay) */}
          <div className="absolute z-20 bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
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
   Wrapper 1260 x 258.75px, each card 305 x 228.75px (square corners)
   ============================================================ */
function HotList(): ReactNode {
  return (
    <section className="bg-white pt-2 pb-6 sm:pb-8" aria-label="Hot list">
      <div className="w-full max-w-[1260px] mx-auto px-4 lg:px-0 lg:h-[258.75px] lg:py-[10px]">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-[13px]">
          {HOT_CARDS.map((card) => (
            <div
              key={card.id}
              className="relative overflow-hidden rounded-none h-[228.75px] w-full lg:w-[305px]"
              style={{ backgroundColor: card.bg }}
            >
              {/* Product photo: right side, full card height */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={card.src}
                alt=""
                aria-hidden="true"
                className="absolute right-0 top-0 h-full w-[62%] object-cover object-center select-none pointer-events-none"
              />

              {/* Text, left side */}
              <div className="relative z-10 h-full pl-[38px] pr-4 pt-[48px] flex flex-col items-start">
                <span className="text-[18px] leading-none text-[#9a9a9a]">{card.eyebrow}</span>
                <h3 className="mt-3 text-[30px] leading-[1.17] font-normal text-[#212529]">
                  {card.title.map((line) => (
                    <span key={line} className="block whitespace-nowrap">
                      {line}
                    </span>
                  ))}
                </h3>
                <Link
                  href={card.path}
                  className="mt-4 inline-flex items-center justify-center h-[52px] px-6 bg-[#e91e63] hover:bg-[#c2185b] text-white text-[15px] font-semibold uppercase rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] focus-visible:ring-offset-2"
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
   Card and photo are square (no radius).
   ADD TO CART button has a slight radius.
   Heart button sits on the top-right of the photo.
   ============================================================ */
interface ProductCardProps {
  product: GraphQLProduct;
  isWishlisted: boolean;
  onToggleWishlist: (product: GraphQLProduct) => void;
  onAdd: (product: GraphQLProduct) => void;
}

function ProductCard({ product, isWishlisted, onToggleWishlist, onAdd }: ProductCardProps): ReactNode {
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  const categoryName: string = product.productCategories?.nodes?.[0]?.name ?? "Uncategorized";
  const discount: number | null = getDiscountPercent(product.price, product.regularPrice);
  const showImage: boolean = Boolean(product.image?.sourceUrl) && !imgFailed;
  const productHref: string = `/product/${product.slug}`;

  return (
    <article className="group relative flex flex-col h-full bg-white rounded-none border border-[#f1f5f9] overflow-hidden shadow-[0_2px_12px_rgba(33,37,41,0.06)] hover:shadow-[0_10px_30px_rgba(33,37,41,0.12)] transition-shadow duration-300">
      {discount !== null && (
        <span className="absolute top-3 left-3 z-10 bg-[#e91e63] text-white text-[13px] font-bold w-[56px] h-[56px] rounded-full flex items-center justify-center">
          {`-${discount}%`}
        </span>
      )}

      {/* Photo wrapper */}
      <div className="relative p-3 pb-0">
        <Link
          href={productHref}
          aria-label={product.name}
          className="block w-full aspect-square rounded-none overflow-hidden bg-[#f8f9fa]"
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
              <svg viewBox="0 0 200 150" className="max-h-[160px] w-auto" role="img" aria-label="Product image placeholder">
                <rect x="62" y="40" width="76" height="76" rx="14" fill="#ffffff" stroke="#212529" strokeWidth="5" />
                <rect x="76" y="22" width="48" height="20" rx="6" fill="#e91e63" />
                <circle cx="100" cy="80" r="16" fill="#fde4ec" />
              </svg>
            </div>
          )}
        </Link>

        {/* Wishlist heart */}
        <button
          type="button"
          onClick={() => onToggleWishlist(product)}
          aria-pressed={isWishlisted}
          aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
          className={`absolute top-5 right-5 z-10 w-[40px] h-[40px] inline-flex items-center justify-center rounded-full shadow transition-colors ${
            isWishlisted ? "bg-[#e91e63] text-white" : "bg-white text-[#212529] hover:text-[#e91e63]"
          }`}
        >
          <HeartIcon filled={isWishlisted} />
        </button>
      </div>

      <div className="flex flex-col flex-1 p-4">
        <Link
          href={productHref}
          title={product.name}
          className="block truncate text-[16px] font-normal text-[#212529] hover:text-[#e91e63] transition-colors"
        >
          {product.name}
        </Link>

        <p className="mt-2 text-[14px] text-[#6c757d] line-clamp-2">{categoryName}</p>

        <div className="mt-auto pt-3 flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline gap-2">
            {product.price ? (
              <span className="text-[16px] font-bold text-[#e91e63]" dangerouslySetInnerHTML={{ __html: product.price }} />
            ) : (
              <span className="text-sm font-semibold text-[#6c757d]">Select options</span>
            )}
            {discount !== null && product.regularPrice && (
              <span className="text-[14px] text-[#6c757d] line-through" dangerouslySetInnerHTML={{ __html: product.regularPrice }} />
            )}
          </div>

          <button
            type="button"
            onClick={() => onAdd(product)}
            disabled={!product.price}
            className="w-full h-[52px] bg-[#e91e63] hover:bg-[#c2185b] disabled:bg-[#f1f5f9] disabled:text-[#6c757d] active:scale-[0.98] text-white text-[15px] font-semibold uppercase rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] focus-visible:ring-offset-2"
          >
            ADD TO CART
          </button>
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   FEATURED PRODUCTS SECTION
   ============================================================ */
interface FeaturedProductsProps {
  products: GraphQLProduct[];
  loading: boolean;
  error: string | null;
  wishlist: string[];
  onRetry: () => void;
  onAdd: (product: GraphQLProduct) => void;
  onToggleWishlist: (product: GraphQLProduct) => void;
}

function FeaturedProducts({
  products,
  loading,
  error,
  wishlist,
  onRetry,
  onAdd,
  onToggleWishlist,
}: FeaturedProductsProps): ReactNode {
  return (
    <section className="bg-white py-6 sm:py-8" aria-labelledby="featured-title">
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
        <div className="text-center max-w-2xl mx-auto mb-8">
          <p className="text-[16px] uppercase text-[#6c757d]">Welcome to Shop &amp; Hope</p>
          <h2 id="featured-title" className="mt-3 text-3xl sm:text-4xl lg:text-[44px] font-bold text-[#212529] tracking-tight">
            Featured Products
          </h2>
          <p className="mt-4 text-sm sm:text-base leading-relaxed text-[#6c757d]">
            Feel confident and stylish in any outfit with Shop &amp; Hope. With a wide
            <br className="hidden sm:block" />
            range of options for men, women, and children.
          </p>
        </div>

        <div>
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-[520px] bg-[#f8f9fa] border border-[#f1f5f9] animate-pulse" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div role="alert" className="max-w-xl mx-auto text-center border border-[#f1f5f9] p-8 bg-[#f8f9fa]">
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

          {!loading && !error && products.length === 0 && (
            <p className="text-center text-[#6c757d]">No products found.</p>
          )}

          {!loading && !error && products.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isWishlisted={wishlist.includes(product.id)}
                  onToggleWishlist={onToggleWishlist}
                  onAdd={onAdd}
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
   3 tiles, each 403.34 x 293.54px, gap 25px, wrapper 1260px
   ============================================================ */
function TrendingSection(): ReactNode {
  return (
    <section className="bg-white py-6 sm:py-8" aria-labelledby="trending-title">
      <div className="w-full max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
        <div className="text-center mb-6">
          <p className="text-[18px] text-[#6c757d]">Top Trending Products</p>
          <h2 id="trending-title" className="mt-3 text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-[#212529]">
            Trending Now: Must-Have Picks
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-[25px]">
          {PROMO_TILES.map((tile) => (
            <Link
              key={tile.id}
              href={tile.path}
              aria-label={tile.title}
              className="group block w-full lg:w-[403.34px] h-auto lg:h-[293.54px] aspect-[403.34/293.54] lg:aspect-auto overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
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
   4 videos in one row, title and Shop Now button centered
   ============================================================ */
function VideoSection(): ReactNode {
  return (
    <section className="bg-white py-6 sm:py-8" aria-label="Video collections">
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {VIDEO_TILES.map((tile) => (
            <div key={tile.id} className="flex flex-col items-center text-center">
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

              <h3 className="mt-3 w-full text-[16px] font-medium text-[#212529]">{tile.title}</h3>

              <Link
                href={tile.path}
                className="mt-3 inline-flex items-center justify-center h-[46px] px-8 bg-[#e91e63] hover:bg-[#c2185b] text-white text-[14px] font-semibold uppercase tracking-wide rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] focus-visible:ring-offset-2"
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
   Header and footer come from app/layout.tsx (SiteHeader / SiteFooter).
   ============================================================ */
export default function HomePage(): ReactNode {
  const [products, setProducts] = useState<GraphQLProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [toast, setToast] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);

  /* Keep card hearts in sync with localStorage wishlist */
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

  /* Fetch 8 products from WPGraphQL */
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

  /* Auto-hide toast */
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* Save the product to the shared cart. The header updates itself via CART_EVENT. */
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

  /* Save the full product to localStorage so the wishlist page can show it */
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
        onToggleWishlist={handleToggleWishlist}
      />
      <TrendingSection />
      <VideoSection />

      {/* Toast */}
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
