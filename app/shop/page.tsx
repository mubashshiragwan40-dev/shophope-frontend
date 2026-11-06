// app/shop/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { WISHLIST_EVENT, readWishlist, toggleWishlist } from "@/lib/wishlist";
import { addToCart } from "@/lib/cart";

/* ============================================================
   TYPES
   ============================================================ */
interface GraphQLCategory {
  databaseId: number;
  name: string;
  slug: string;
  parentDatabaseId: number | null;
}

interface GraphQLProduct {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  price: string;
  regularPrice: string | null;
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

/* Result of one fetch, tagged with the request key it belongs to */
interface FetchResult {
  key: string;
  products: GraphQLProduct[];
  error: string | null;
}

interface CategoryNode {
  id: number;
  name: string;
  count: number;
  children: CategoryNode[];
}

interface PriceRange {
  min: string;
  max: string;
}

interface FilterState {
  categoryId: number | null;
  price: PriceRange;
  onSale: boolean;
  colors: string[];
  sizes: string[];
}

type SortKey = "default" | "price-asc" | "price-desc" | "name-asc";

/* ============================================================
   CONSTANTS
   ============================================================ */
const API_URL: string =
  process.env.NEXT_PUBLIC_WORDPRESS_API_URL || "http://localhost/shophope/graphql";

/* $term is optional. When it is null, WPGraphQL returns the full catalogue. */
const PRODUCTS_QUERY: string = `
  query GetShopProducts($term: String) {
    products(first: 48, where: { search: $term }) {
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
            databaseId
            name
            slug
            parentDatabaseId
          }
        }
      }
    }
  }
`;

const PAGE_SIZE: number = 12;
const PARENT_VISIBLE_COUNT: number = 8;

const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "default", label: "Default sorting" },
  { value: "name-asc", label: "Sort by name" },
  { value: "price-asc", label: "Sort by price: low to high" },
  { value: "price-desc", label: "Sort by price: high to low" },
];

const COLORS: string[] = ["Blue", "Corn Yellow", "Dull Brown", "Ebony Clay", "Mushroom", "Red", "Tealish Blue"];
const SIZES: string[] = ["Free size", "L", "XL"];

const EMPTY_FILTERS: FilterState = {
  categoryId: null,
  price: { min: "", max: "" },
  onSale: false,
  colors: [],
  sizes: [],
};

/* Stable empty list, so memos do not recompute on every render while loading */
const NO_PRODUCTS: GraphQLProduct[] = [];

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

/** Number of filters that are currently active (used for the badge on the Filter button). */
function countActiveFilters(filters: FilterState): number {
  let count = 0;
  if (filters.categoryId !== null) count += 1;
  if (filters.price.min !== "" || filters.price.max !== "") count += 1;
  if (filters.onSale) count += 1;
  count += filters.colors.length;
  count += filters.sizes.length;
  return count;
}

/**
 * Build a parent -> children category tree from the categories found on products.
 * A category counts as a "parent" when it has no parent (parentDatabaseId is null or 0)
 * or when its parent is not part of the loaded data.
 * Product counts include products of all child categories.
 */
function buildCategoryTree(products: GraphQLProduct[]): CategoryNode[] {
  const byId = new Map<number, GraphQLCategory>();
  const productIdsByCategory = new Map<number, Set<string>>();

  products.forEach((product) => {
    (product.productCategories?.nodes ?? []).forEach((cat) => {
      byId.set(cat.databaseId, cat);
      if (!productIdsByCategory.has(cat.databaseId)) {
        productIdsByCategory.set(cat.databaseId, new Set<string>());
      }
      productIdsByCategory.get(cat.databaseId)?.add(product.id);
    });
  });

  const parentOf = (cat: GraphQLCategory): number | null => {
    const parentId = cat.parentDatabaseId;
    if (!parentId) return null;
    return byId.has(parentId) ? parentId : null;
  };

  const childrenByParent = new Map<number, GraphQLCategory[]>();
  const roots: GraphQLCategory[] = [];

  byId.forEach((cat) => {
    const parentId = parentOf(cat);
    if (parentId === null) {
      roots.push(cat);
    } else {
      const list = childrenByParent.get(parentId) ?? [];
      list.push(cat);
      childrenByParent.set(parentId, list);
    }
  });

  const collectProductIds = (catId: number): Set<string> => {
    const ids = new Set<string>(productIdsByCategory.get(catId) ?? []);
    (childrenByParent.get(catId) ?? []).forEach((child) => {
      collectProductIds(child.databaseId).forEach((id) => ids.add(id));
    });
    return ids;
  };

  const toNode = (cat: GraphQLCategory): CategoryNode => ({
    id: cat.databaseId,
    name: cat.name,
    count: collectProductIds(cat.databaseId).size,
    children: (childrenByParent.get(cat.databaseId) ?? [])
      .map(toNode)
      .sort((a, b) => a.name.localeCompare(b.name)),
  });

  return roots.map(toNode).sort((a, b) => a.name.localeCompare(b.name));
}

/** Returns the id of the category and all its descendants. */
function collectCategoryIds(node: CategoryNode): number[] {
  return [node.id, ...node.children.flatMap(collectCategoryIds)];
}

/* ============================================================
   ICONS
   ============================================================ */
function HeartIcon(): ReactNode {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

function FilterIcon(): ReactNode {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18" />
      <path d="M6 12h12" />
      <path d="M10 19h4" />
    </svg>
  );
}

function CloseIcon(): ReactNode {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/* ============================================================
   PAGE BANNER (breadcrumb + title)
   ============================================================ */
function PageBanner(): ReactNode {
  return (
    <section className="bg-[#f8f9fa] border-b border-[#f1f5f9]">
      <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0 py-8 text-center">
        <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight text-[#212529]">Shop</h1>
        <nav aria-label="Breadcrumb" className="mt-3 text-sm text-[#6c757d]">
          <Link href="/" className="hover:text-[#e91e63] transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[#212529]">Shop</span>
        </nav>
      </div>
    </section>
  );
}

/* ============================================================
   FILTERS PANEL
   Shared by the desktop sidebar and the mobile bottom sheet.
   It is fully controlled: it reads `value` and reports changes via `onChange`.
   ============================================================ */
function SidebarSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div className="py-5 border-b border-[#f1f5f9]">
      <h3 className="text-[15px] font-bold uppercase tracking-wide text-[#212529] mb-3">{title}</h3>
      {children}
    </div>
  );
}

/**
 * Parent categories with expandable children.
 * - Only parent categories are listed by default.
 * - Parents that have children get a +/- toggle to show the child list.
 * - A parent that contains the selected category stays expanded.
 * - "See more / See less" limits long parent lists.
 */
function CategoryList({
  tree,
  totalProducts,
  selectedId,
  onSelect,
}: {
  tree: CategoryNode[];
  totalProducts: number;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}): ReactNode {
  const [expandedIds, setExpandedIds] = useState<number[]>([]);
  const [showAll, setShowAll] = useState<boolean>(false);

  /* The parent of the selected child is always open (derived during render, no effect) */
  const selectedParentId: number | null =
    selectedId === null
      ? null
      : tree.find((node) => node.children.some((c) => collectCategoryIds(c).includes(selectedId)))?.id ?? null;
  const openIds: number[] =
    selectedParentId !== null && !expandedIds.includes(selectedParentId)
      ? [...expandedIds, selectedParentId]
      : expandedIds;

  const visibleTree: CategoryNode[] = showAll ? tree : tree.slice(0, PARENT_VISIBLE_COUNT);
  const hiddenCount: number = tree.length - PARENT_VISIBLE_COUNT;

  const toggleExpanded = (id: number): void => {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const itemClass = (active: boolean): string =>
    `flex-1 min-w-0 text-left py-1.5 text-[14px] transition-colors hover:text-[#e91e63] ${
      active ? "text-[#e91e63] font-semibold" : "text-[#495057]"
    }`;

  return (
    <ul className="text-[14px]">
      <li>
        <button type="button" onClick={() => onSelect(null)} className={`${itemClass(selectedId === null)} w-full flex items-center justify-between gap-2`}>
          <span>All products</span>
          <span className="text-[12px] text-[#6c757d]">{totalProducts}</span>
        </button>
      </li>

      {visibleTree.map((parent) => {
        const hasChildren: boolean = parent.children.length > 0;
        const isExpanded: boolean = openIds.includes(parent.id);
        const parentActive: boolean = selectedId === parent.id;

        return (
          <li key={parent.id}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSelect(parent.id)}
                className={`${itemClass(parentActive)} flex items-center justify-between gap-2`}
              >
                <span className="truncate">{parent.name}</span>
                <span className="text-[12px] text-[#6c757d] shrink-0">{parent.count}</span>
              </button>

              {hasChildren && (
                <button
                  type="button"
                  onClick={() => toggleExpanded(parent.id)}
                  aria-expanded={isExpanded}
                  aria-label={`${isExpanded ? "Collapse" : "Expand"} ${parent.name}`}
                  className="w-7 h-7 shrink-0 inline-flex items-center justify-center text-[#6c757d] hover:text-[#e91e63] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                    {isExpanded ? <path d="M5 12h14" /> : <path d="M12 5v14M5 12h14" />}
                  </svg>
                </button>
              )}
            </div>

            {hasChildren && isExpanded && (
              <ul className="ml-3 pl-3 border-l border-[#f1f5f9] mb-1">
                {parent.children.map((child) => (
                  <li key={child.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(child.id)}
                      className={`${itemClass(selectedId === child.id)} w-full flex items-center justify-between gap-2`}
                    >
                      <span className="truncate">{child.name}</span>
                      <span className="text-[12px] text-[#6c757d] shrink-0">{child.count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}

      {hiddenCount > 0 && (
        <li className="pt-2">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="text-[13px] font-semibold text-[#e91e63] hover:text-[#c2185b] transition-colors"
          >
            {showAll ? "See less" : `See more (${hiddenCount})`}
          </button>
        </li>
      )}
    </ul>
  );
}

interface FiltersPanelProps {
  categoryTree: CategoryNode[];
  totalProducts: number;
  value: FilterState;
  onChange: (next: FilterState) => void;
  /** Desktop shows a small "Filter" button under the price inputs. Mobile uses the sheet Apply button. */
  showPriceApplyButton: boolean;
  onApplyPrice?: () => void;
}

function FiltersPanel({
  categoryTree,
  totalProducts,
  value,
  onChange,
  showPriceApplyButton,
  onApplyPrice,
}: FiltersPanelProps): ReactNode {
  const toggleInList = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((v) => v !== item) : [...list, item];

  return (
    <div className="w-full">
      <SidebarSection title="Categories">
        <CategoryList
          tree={categoryTree}
          totalProducts={totalProducts}
          selectedId={value.categoryId}
          onSelect={(id) => onChange({ ...value, categoryId: id })}
        />
      </SidebarSection>

      <SidebarSection title="Filter by price">
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="Min"
            aria-label="Minimum price"
            value={value.price.min}
            onChange={(e) => onChange({ ...value, price: { ...value.price, min: e.target.value } })}
            className="w-full h-11 px-3 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#e91e63]"
          />
          <input
            type="number"
            min={0}
            inputMode="decimal"
            placeholder="Max"
            aria-label="Maximum price"
            value={value.price.max}
            onChange={(e) => onChange({ ...value, price: { ...value.price, max: e.target.value } })}
            className="w-full h-11 px-3 border border-[#dee2e6] rounded-md text-sm focus:outline-none focus:border-[#e91e63]"
          />
        </div>
        {showPriceApplyButton && (
          <button
            type="button"
            onClick={onApplyPrice}
            className="mt-3 h-10 px-5 bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-bold uppercase tracking-wide rounded-md transition-colors"
          >
            Filter
          </button>
        )}
      </SidebarSection>

      <SidebarSection title="Filter by color">
        <ul className="space-y-2 text-[14px] text-[#495057]">
          {COLORS.map((color) => (
            <li key={color}>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={value.colors.includes(color)}
                  onChange={() => onChange({ ...value, colors: toggleInList(value.colors, color) })}
                  className="w-4 h-4 accent-[#e91e63]"
                />
                {color}
              </label>
            </li>
          ))}
        </ul>
      </SidebarSection>

      <SidebarSection title="Filter by size">
        <ul className="space-y-2 text-[14px] text-[#495057]">
          {SIZES.map((size) => (
            <li key={size}>
              <label className="flex items-center gap-2 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={value.sizes.includes(size)}
                  onChange={() => onChange({ ...value, sizes: toggleInList(value.sizes, size) })}
                  className="w-4 h-4 accent-[#e91e63]"
                />
                {size}
              </label>
            </li>
          ))}
        </ul>
      </SidebarSection>

      <SidebarSection title="Stock status">
        <ul className="space-y-2 text-[14px] text-[#495057]">
          <li>
            <label className="flex items-center gap-2 cursor-pointer py-1">
              <input
                type="checkbox"
                checked={value.onSale}
                onChange={(e) => onChange({ ...value, onSale: e.target.checked })}
                className="w-4 h-4 accent-[#e91e63]"
              />
              On sale
            </label>
          </li>
        </ul>
      </SidebarSection>
    </div>
  );
}

/* ============================================================
   MOBILE FILTER SHEET (bottom sheet / drawer)
   - Opens from the Filter button on mobile.
   - Changes stay in a draft until the user taps Apply.
   - Close with the X button, overlay tap, or the Esc key.
   - Page scroll is locked while the sheet is open.
   ============================================================ */
interface MobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
  categoryTree: CategoryNode[];
  totalProducts: number;
  applied: FilterState;
  onApply: (next: FilterState) => void;
}

function MobileFilterSheet({
  open,
  onClose,
  categoryTree,
  totalProducts,
  applied,
  onApply,
}: MobileFilterSheetProps): ReactNode {
  const [draft, setDraft] = useState<FilterState>(applied);
  const [wasOpen, setWasOpen] = useState<boolean>(open);

  /* Start from the applied filters each time the sheet opens (adjusted during render, no effect) */
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(applied);
  }

  /* Lock background scroll and close on Esc */
  useEffect(() => {
    if (!open) return;

    const previousOverflow: string = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  const draftCount: number = countActiveFilters(draft);

  return (
    <div
      className={`lg:hidden fixed inset-0 z-[70] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Overlay */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className={`absolute inset-x-0 bottom-0 flex flex-col max-h-[88vh] bg-white rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 h-14 border-b border-[#f1f5f9] shrink-0">
          <h2 className="text-[17px] font-bold text-[#212529]">
            Filters{draftCount > 0 ? ` (${draftCount})` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="w-9 h-9 inline-flex items-center justify-center text-[#212529] hover:text-[#e91e63] transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-5">
          <FiltersPanel
            categoryTree={categoryTree}
            totalProducts={totalProducts}
            value={draft}
            onChange={setDraft}
            showPriceApplyButton={false}
          />
        </div>

        {/* Footer actions */}
        <div className="shrink-0 flex items-center gap-3 px-5 py-4 border-t border-[#f1f5f9] bg-white">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            disabled={draftCount === 0}
            className="h-12 px-5 border border-[#dee2e6] rounded-md text-[14px] font-semibold uppercase text-[#212529] hover:border-[#e91e63] hover:text-[#e91e63] disabled:opacity-40 disabled:hover:border-[#dee2e6] disabled:hover:text-[#212529] transition-colors"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="flex-1 h-12 bg-[#e91e63] hover:bg-[#c2185b] active:scale-[0.98] text-white text-[14px] font-semibold uppercase rounded-md transition-all"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   PRODUCT CARD
   Hover reveals Quick view and Add to wishlist.
   ============================================================ */
interface ShopProductCardProps {
  product: GraphQLProduct;
  isWishlisted: boolean;
  onToggleWishlist: (product: GraphQLProduct) => void;
  onAdd: (product: GraphQLProduct) => void;
}

function ShopProductCard({ product, isWishlisted, onToggleWishlist, onAdd }: ShopProductCardProps): ReactNode {
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  const categoryName: string =
    product.productCategories?.nodes?.map((n) => n.name).join(" , ") || "Uncategorized";
  const discount: number | null = getDiscountPercent(product.price, product.regularPrice);
  const showImage: boolean = Boolean(product.image?.sourceUrl) && !imgFailed;
  const productHref: string = `/product/${product.slug}`;

  return (
    <article className="group relative flex flex-col h-full bg-white border border-[#f1f5f9] shadow-[0_2px_12px_rgba(33,37,41,0.06)] hover:shadow-[0_10px_30px_rgba(33,37,41,0.12)] transition-shadow duration-300">
      {discount !== null && (
        <span className="absolute top-3 left-3 z-10 bg-[#e91e63] text-white text-[13px] font-bold w-[52px] h-[52px] rounded-full flex items-center justify-center">
          {`-${discount}%`}
        </span>
      )}

      <div className="relative p-3 pb-0">
        <Link
          href={productHref}
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
              <svg viewBox="0 0 200 150" className="max-h-[160px] w-auto" role="img" aria-label="Product image placeholder">
                <rect x="62" y="40" width="76" height="76" rx="14" fill="#ffffff" stroke="#212529" strokeWidth="5" />
                <rect x="76" y="22" width="48" height="20" rx="6" fill="#e91e63" />
                <circle cx="100" cy="80" r="16" fill="#fde4ec" />
              </svg>
            </div>
          )}
        </Link>

        {/* Hover actions */}
        <div className="absolute inset-x-3 bottom-3 flex gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
          <Link
            href={productHref}
            className="flex-1 h-[40px] inline-flex items-center justify-center bg-white text-[#212529] hover:text-[#e91e63] text-[13px] font-semibold uppercase shadow"
          >
            Quick view
          </Link>
          <button
            type="button"
            onClick={() => onToggleWishlist(product)}
            aria-pressed={isWishlisted}
            aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            className={`w-[40px] h-[40px] inline-flex items-center justify-center shadow transition-colors ${
              isWishlisted ? "bg-[#e91e63] text-white" : "bg-white text-[#212529] hover:text-[#e91e63]"
            }`}
          >
            <HeartIcon />
          </button>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-4">
        <Link
          href={productHref}
          title={product.name}
          className="block truncate text-[16px] font-normal text-[#212529] hover:text-[#e91e63] transition-colors"
        >
          {product.name}
        </Link>

        <p className="mt-2 text-[13px] text-[#6c757d] truncate" title={categoryName}>
          {categoryName}
        </p>

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
            className="w-full h-[48px] bg-[#e91e63] hover:bg-[#c2185b] disabled:bg-[#f1f5f9] disabled:text-[#6c757d] active:scale-[0.98] text-white text-[14px] font-semibold uppercase rounded-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63] focus-visible:ring-offset-2"
          >
            ADD TO CART
          </button>
        </div>
      </div>
    </article>
  );
}

/* ============================================================
   PAGINATION
   ============================================================ */
function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}): ReactNode {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pagination" className="mt-10 flex justify-center items-center gap-2">
      {Array.from({ length: pageCount }).map((_, i) => {
        const n: number = i + 1;
        const active: boolean = n === page;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-current={active ? "page" : undefined}
            className={`w-10 h-10 text-sm font-semibold rounded-md border transition-colors ${
              active
                ? "bg-[#e91e63] border-[#e91e63] text-white"
                : "bg-white border-[#dee2e6] text-[#212529] hover:border-[#e91e63] hover:text-[#e91e63]"
            }`}
          >
            {n}
          </button>
        );
      })}
    </nav>
  );
}

/* ============================================================
   SHOP CONTENT
   Header and footer come from app/layout.tsx (SiteHeader / SiteFooter).
   Reads ?search= from the URL and sends it to the WooCommerce search.
   ============================================================ */
function ShopContent(): ReactNode {
  const searchParams = useSearchParams();
  const searchTerm: string = (searchParams.get("search") ?? "").trim();
  const isSearching: boolean = searchTerm !== "";

  const [reloadKey, setReloadKey] = useState<number>(0);

  /* Result of the latest request, tagged with the request key.
     Loading and error are derived from it, so the fetch effect never sets state synchronously. */
  const requestKey: string = `${searchTerm}|${reloadKey}`;
  const [result, setResult] = useState<FetchResult | null>(null);
  const loading: boolean = result === null || result.key !== requestKey;
  const products: GraphQLProduct[] = !loading && result ? result.products : NO_PRODUCTS;
  const error: string | null = !loading && result ? result.error : null;

  const [toast, setToast] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);

  /* Desktop sidebar visibility (Hide / Show sidebar) */
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  /* Mobile filter sheet visibility */
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);

  const [sort, setSort] = useState<SortKey>("default");
  const [page, setPage] = useState<number>(1);

  /* Applied filters: the single source of truth used to filter products */
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  /* Desktop price inputs are typed first and applied with the small Filter button */
  const [desktopPriceDraft, setDesktopPriceDraft] = useState<PriceRange>({ min: "", max: "" });

  /* Clear filters when a new search starts (adjusted during render, no effect),
     so old filters do not hide the new results */
  const [prevSearchTerm, setPrevSearchTerm] = useState<string>(searchTerm);
  if (searchTerm !== prevSearchTerm) {
    setPrevSearchTerm(searchTerm);
    setFilters(EMPTY_FILTERS);
    setDesktopPriceDraft({ min: "", max: "" });
  }

  /* Keep wishlist hearts in sync with localStorage */
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

  /* Fetch products. Refetches whenever the search term or the retry key changes. */
  useEffect(() => {
    const controller = new AbortController();
    const key: string = `${searchTerm}|${reloadKey}`;

    async function loadProducts(): Promise<void> {
      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: PRODUCTS_QUERY,
            variables: { term: isSearching ? searchTerm : null },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`GraphQL request failed with status ${res.status}`);
        }

        const json: GraphQLResponse = await res.json();

        if (json.errors && json.errors.length > 0) {
          throw new Error(json.errors[0].message);
        }

        if (!controller.signal.aborted) {
          setResult({ key, products: json.data?.products?.nodes ?? [], error: null });
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!controller.signal.aborted) {
          setResult({
            key,
            products: [],
            error: err instanceof Error ? err.message : "Unable to load products.",
          });
        }
      }
    }

    loadProducts();
    return () => controller.abort();
  }, [reloadKey, searchTerm, isSearching]);

  /* Toast auto-hide */
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* Parent -> children category tree built from the loaded products */
  const categoryTree: CategoryNode[] = useMemo(() => buildCategoryTree(products), [products]);

  /* Ids that match the selected category (the category itself plus all its children) */
  const selectedCategoryIds: number[] | null = useMemo(() => {
    if (filters.categoryId === null) return null;

    const findNode = (nodes: CategoryNode[]): CategoryNode | null => {
      for (const node of nodes) {
        if (node.id === filters.categoryId) return node;
        const inChild = findNode(node.children);
        if (inChild) return inChild;
      }
      return null;
    };

    const node = findNode(categoryTree);
    return node ? collectCategoryIds(node) : [filters.categoryId];
  }, [filters.categoryId, categoryTree]);

  /* Filter + sort */
  const filtered: GraphQLProduct[] = useMemo(() => {
    const min: number | null = filters.price.min === "" ? null : Number(filters.price.min);
    const max: number | null = filters.price.max === "" ? null : Number(filters.price.max);

    let list: GraphQLProduct[] = products.filter((p) => {
      const amount = parseAmount(p.price);
      if (min !== null && (amount === null || amount < min)) return false;
      if (max !== null && (amount === null || amount > max)) return false;
      if (
        selectedCategoryIds &&
        !(p.productCategories?.nodes ?? []).some((n) => selectedCategoryIds.includes(n.databaseId))
      ) {
        return false;
      }
      if (filters.onSale && getDiscountPercent(p.price, p.regularPrice) === null) return false;
      return true;
    });

    if (sort === "price-asc") {
      list = [...list].sort((a, b) => (parseAmount(a.price) ?? 0) - (parseAmount(b.price) ?? 0));
    } else if (sort === "price-desc") {
      list = [...list].sort((a, b) => (parseAmount(b.price) ?? 0) - (parseAmount(a.price) ?? 0));
    } else if (sort === "name-asc") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [products, filters, selectedCategoryIds, sort]);

  /* Reset to page 1 when filters, sort or search change (adjusted during render, no effect) */
  const resetKey: string = `${sort}|${searchTerm}|${JSON.stringify(filters)}|${filtered.length}`;
  const [prevResetKey, setPrevResetKey] = useState<string>(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }

  const pageCount: number = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage: number = Math.min(page, pageCount);
  const pageItems: GraphQLProduct[] = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const rangeStart: number = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd: number = Math.min(currentPage * PAGE_SIZE, filtered.length);

  const activeFilterCount: number = countActiveFilters(filters);

  /* Desktop: every change applies immediately except price, which waits for the Filter button */
  const handleDesktopChange = (next: FilterState): void => {
    setDesktopPriceDraft(next.price);
    setFilters({ ...next, price: filters.price });
  };

  const handleDesktopApplyPrice = (): void => {
    setFilters((prev) => ({ ...prev, price: desktopPriceDraft }));
  };

  /* Mobile sheet Apply: also keep the desktop price inputs in sync */
  const handleMobileApply = (next: FilterState): void => {
    setFilters(next);
    setDesktopPriceDraft(next.price);
  };

  const handleClearAll = (): void => {
    setFilters(EMPTY_FILTERS);
    setDesktopPriceDraft({ min: "", max: "" });
  };

  /* Save the product to the shared cart (lib/cart.ts). The header updates itself via CART_EVENT. */
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
      <PageBanner />

      <section className="bg-white py-8">
        <div className="max-w-[1260px] mx-auto px-4 sm:px-6 lg:px-0">
          <div className={`grid gap-8 ${showSidebar ? "lg:grid-cols-[260px_1fr]" : "grid-cols-1"}`}>
            {/* Desktop sidebar: hidden on mobile and tablet */}
            {showSidebar && (
              <aside className="hidden lg:block" aria-label="Product filters">
                <FiltersPanel
                  categoryTree={categoryTree}
                  totalProducts={products.length}
                  value={{ ...filters, price: desktopPriceDraft }}
                  onChange={handleDesktopChange}
                  showPriceApplyButton
                  onApplyPrice={handleDesktopApplyPrice}
                />
              </aside>
            )}

            <div>
              {/* Search summary: shown only when the URL has a search term */}
              {isSearching && (
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-[#f8f9fa] border border-[#f1f5f9] px-4 py-3">
                  <p className="text-sm text-[#495057]">
                    Search results for{" "}
                    <span className="font-semibold text-[#212529]">&quot;{searchTerm}&quot;</span>
                  </p>
                  <Link
                    href="/shop"
                    className="text-[13px] font-semibold uppercase text-[#e91e63] hover:text-[#c2185b] transition-colors"
                  >
                    Clear search
                  </Link>
                </div>
              )}

              {/* Toolbar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-[#f1f5f9]">
                <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                  {/* Mobile / tablet: opens the filter sheet */}
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    aria-haspopup="dialog"
                    className="lg:hidden h-10 px-4 inline-flex items-center gap-2 border border-[#dee2e6] text-sm font-semibold uppercase rounded-md hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
                  >
                    <FilterIcon />
                    Filter
                    {activeFilterCount > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#e91e63] text-white text-[11px] font-bold flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  {/* Desktop: hide / show the sidebar */}
                  <button
                    type="button"
                    onClick={() => setShowSidebar((prev) => !prev)}
                    className="hidden lg:inline-flex h-10 px-4 items-center border border-[#dee2e6] text-sm font-semibold uppercase rounded-md hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
                  >
                    {showSidebar ? "Hide sidebar" : "Show sidebar"}
                  </button>

                  <p className="text-sm text-[#6c757d]">
                    {loading ? "Loading products..." : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length} results`}
                  </p>
                </div>

                <select
                  aria-label="Shop order"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-10 px-3 border border-[#dee2e6] rounded-md text-sm bg-white focus:outline-none focus:border-[#e91e63]"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Active filters hint (mobile): quick way to clear without opening the sheet */}
              {activeFilterCount > 0 && (
                <div className="lg:hidden -mt-2 mb-5 flex items-center justify-between text-sm">
                  <span className="text-[#6c757d]">{`${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} applied`}</span>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="font-semibold text-[#e91e63] hover:text-[#c2185b] transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Loading */}
              {loading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6" aria-busy="true">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-[460px] bg-[#f8f9fa] border border-[#f1f5f9] animate-pulse" />
                  ))}
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div role="alert" className="max-w-xl mx-auto text-center border border-[#f1f5f9] p-8 bg-[#f8f9fa]">
                  <p className="font-bold text-[#212529]">We couldn&apos;t load products.</p>
                  <p className="mt-1 text-sm text-[#6c757d]">{error}</p>
                  <button
                    type="button"
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="mt-5 bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-full transition-colors"
                  >
                    RETRY
                  </button>
                </div>
              )}

              {/* Empty: no search matches, or filters exclude everything */}
              {!loading && !error && filtered.length === 0 && (
                <div className="text-center py-12">
                  {isSearching && products.length === 0 ? (
                    <>
                      <p className="text-[#212529] font-semibold">
                        No products match <span className="text-[#e91e63]">&quot;{searchTerm}&quot;</span>.
                      </p>
                      <p className="mt-2 text-sm text-[#6c757d]">Try a different keyword or browse all products.</p>
                      <Link
                        href="/shop"
                        className="mt-5 inline-flex h-11 items-center px-6 bg-[#e91e63] hover:bg-[#c2185b] text-white text-[13px] font-semibold uppercase rounded-md transition-colors"
                      >
                        Browse all products
                      </Link>
                    </>
                  ) : (
                    <>
                      <p className="text-[#6c757d]">No products match these filters.</p>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAll}
                          className="mt-4 h-11 px-6 bg-[#e91e63] hover:bg-[#c2185b] text-white text-[13px] font-semibold uppercase rounded-md transition-colors"
                        >
                          Clear all filters
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Grid */}
              {!loading && !error && pageItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {pageItems.map((product) => (
                    <ShopProductCard
                      key={product.id}
                      product={product}
                      isWishlisted={wishlist.includes(product.id)}
                      onToggleWishlist={handleToggleWishlist}
                      onAdd={handleAddToCart}
                    />
                  ))}
                </div>
              )}

              <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
            </div>
          </div>
        </div>
      </section>

      {/* Mobile filter bottom sheet */}
      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        categoryTree={categoryTree}
        totalProducts={products.length}
        applied={filters}
        onApply={handleMobileApply}
      />

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

/* ============================================================
   PAGE
   useSearchParams needs a Suspense boundary in the App Router.
   ============================================================ */
export default function ShopPage(): ReactNode {
  return (
    <Suspense fallback={null}>
      <ShopContent />
    </Suspense>
  );
}
