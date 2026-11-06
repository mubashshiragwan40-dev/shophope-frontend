// components/product-search.tsx
"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/* ============================================================
   TYPES
   ============================================================ */
interface SearchProduct {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  price: string | null;
  image: { sourceUrl: string } | null;
}

interface SearchResponse {
  data?: { products?: { nodes: SearchProduct[] } };
  errors?: Array<{ message: string }>;
}

interface ProductSearchProps {
  /** Called after a navigation so the parent can close the search bar. */
  onNavigate?: () => void;
  autoFocus?: boolean;
}

/* ============================================================
   CONSTANTS
   ============================================================ */
const API_URL: string =
  process.env.NEXT_PUBLIC_WORDPRESS_API_URL || "http://localhost/shophope/graphql";

const MIN_CHARS: number = 2;
const DEBOUNCE_MS: number = 300;
const SUGGESTION_LIMIT: number = 6;

const SEARCH_QUERY: string = `
  query SearchProducts($term: String!) {
    products(first: ${SUGGESTION_LIMIT}, where: { search: $term }) {
      nodes {
        id
        databaseId
        name
        slug
        image {
          sourceUrl
        }
        ... on SimpleProduct {
          price
        }
      }
    }
  }
`;

/* ============================================================
   HELPERS
   ============================================================ */
/** WooCommerce prices arrive as HTML. Convert them to plain text. */
function toPlainText(html: string | null): string {
  return html ? html.replace(/<[^>]*>/g, "").trim() : "";
}

/* ============================================================
   ICONS
   ============================================================ */
function SearchGlyph(): ReactNode {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CloseGlyph(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/* ============================================================
   COMPONENT
   ============================================================ */
export default function ProductSearch({ onNavigate, autoFocus = false }: ProductSearchProps): ReactNode {
  const router = useRouter();
  const inputId: string = useId();
  const listId: string = `${inputId}-results`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState<string>("");
  const [open, setOpen] = useState<boolean>(false);
  const [results, setResults] = useState<SearchProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const term: string = query.trim();
  const showPanel: boolean = open && term.length >= MIN_CHARS;

  /* Debounced fetch. Stale requests are aborted when the user keeps typing. */
  useEffect(() => {
    if (term.length < MIN_CHARS) {
      // Clear results when the query is too short.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setError(null);
      setLoading(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer: number = window.setTimeout(async () => {
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: SEARCH_QUERY, variables: { term } }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed with status ${res.status}`);

        const json: SearchResponse = await res.json();
        if (json.errors && json.errors.length > 0) throw new Error(json.errors[0].message);

        setResults(json.data?.products?.nodes ?? []);
        setActiveIndex(-1);
      } catch {
        if (controller.signal.aborted) return;
        setResults([]);
        setError("Search is unavailable right now. Press Enter to search the full shop.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  /* Close the suggestions when the user clicks outside the search box */
  useEffect(() => {
    function handlePointerDown(event: MouseEvent): void {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function finish(): void {
    setOpen(false);
    setActiveIndex(-1);
    setQuery("");
    onNavigate?.();
  }

  function goToResults(): void {
    if (term === "") return;
    finish();
    router.push(`/shop?search=${encodeURIComponent(term)}`);
  }

  function clearQuery(): void {
    setQuery("");
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const highlighted: SearchProduct | undefined = results[activeIndex];
    if (highlighted) {
      finish();
      router.push(`/product/${highlighted.slug}`);
      return;
    }
    goToResults();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((i: number) => (results.length === 0 ? -1 : (i + 1) % results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i: number) =>
        results.length === 0 ? -1 : i <= 0 ? results.length - 1 : i - 1
      );
    } else if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={wrapperRef} className="relative w-full">
      <form role="search" onSubmit={handleSubmit} className="flex items-stretch gap-2">
        <div className="relative flex-1">
          <label htmlFor={inputId} className="sr-only">
            Search products
          </label>

          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6c757d]">
            <SearchGlyph />
          </span>

          <input
            ref={inputRef}
            id={inputId}
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
            autoComplete="off"
            autoFocus={autoFocus}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search for products, categories and more"
            className="h-12 w-full pl-11 pr-11 bg-white border border-[#dee2e6] rounded-md text-[15px] text-[#212529] placeholder:text-[#adb5bd] transition-colors focus:outline-none focus:border-[#e91e63] focus:ring-2 focus:ring-[#e91e63]/15 [&::-webkit-search-cancel-button]:hidden"
          />

          {query !== "" && (
            <button
              type="button"
              onClick={clearQuery}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 inline-flex items-center justify-center rounded-full text-[#6c757d] hover:text-[#e91e63] hover:bg-[#fdf2f6] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]"
            >
              <CloseGlyph />
            </button>
          )}
        </div>

        <button
          type="submit"
          className="h-12 px-6 bg-[#e91e63] hover:bg-[#c2185b] text-white text-[14px] font-semibold uppercase tracking-wide rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] focus-visible:ring-offset-2"
        >
          Search
        </button>
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden bg-white border border-[#f1f5f9] rounded-md shadow-[0_10px_30px_rgba(33,37,41,0.12)]">
          {loading && (
            <div className="p-3 space-y-3" aria-busy="true" aria-label="Searching">
              {Array.from({ length: 3 }).map((_, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-[#f8f9fa] animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 bg-[#f8f9fa] animate-pulse" />
                    <div className="h-3 w-1/4 bg-[#f8f9fa] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <p role="alert" className="px-4 py-4 text-sm text-[#6c757d]">
              {error}
            </p>
          )}

          {!loading && !error && results.length === 0 && (
            <p className="px-4 py-4 text-sm text-[#6c757d]">
              No products match <span className="font-semibold text-[#212529]">&quot;{term}&quot;</span>.
            </p>
          )}

          {!loading && results.length > 0 && (
            <>
              <div id={listId} role="listbox" aria-label="Search suggestions">
                {results.map((product: SearchProduct, index: number) => {
                  const price: string = toPlainText(product.price);
                  const active: boolean = index === activeIndex;
                  return (
                    <Link
                      key={product.id}
                      id={`${listId}-${index}`}
                      role="option"
                      aria-selected={active}
                      href={`/product/${product.slug}`}
                      onClick={finish}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={`flex items-center gap-3 px-4 py-3 border-b border-[#f1f5f9] transition-colors ${
                        active ? "bg-[#fdf2f6]" : "bg-white"
                      }`}
                    >
                      <span className="w-12 h-12 shrink-0 bg-[#f8f9fa] overflow-hidden">
                        {product.image?.sourceUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image.sourceUrl} alt="" className="w-full h-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-[#212529]">{product.name}</span>
                        {price && (
                          <span className="block mt-0.5 text-[14px] font-bold text-[#e91e63]">{price}</span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={goToResults}
                className="w-full px-4 py-3 text-left text-[13px] font-semibold uppercase tracking-wide text-[#e91e63] hover:bg-[#fdf2f6] transition-colors"
              >
                View all results for &quot;{term}&quot;
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
