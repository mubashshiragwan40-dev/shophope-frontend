// app/shop/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { WISHLIST_EVENT, readWishlist, toggleWishlist } from "@/lib/wishlist";
import { addToCart, formatKD, type CartItem } from "@/lib/cart";
import { EXPRESS_BUY_NOW_KEY } from "@/app/product/[slug]/product-client";
import { SHOP_OPEN_FILTERS_EVENT } from "@/components/site-header";
import ProtectedProductImage from "@/components/protected-product-image";
import QuickSelectModal, {
  type QuickSelectAction,
  type QuickSelectProduct,
  type QuickSelectVariation,
} from "@/components/quick-select-modal";

/* ============================================================
   TYPES
   ============================================================ */
interface GraphQLCategory {
  databaseId: number;
  name: string;
  slug: string;
  parentDatabaseId: number | null;
}

interface GraphQLAttribute {
  name: string;
  options: string[];
}

interface GraphQLProduct extends QuickSelectProduct {
  stockStatus?: string | null;
  productCategories: { nodes: GraphQLCategory[] } | null;
  productTags?: { nodes: Array<{ name: string; slug: string }> } | null;
  attributes?: {
    nodes: GraphQLAttribute[];
  } | null;
}

interface GraphQLResponse {
  data?: {
    products?: {
      nodes: GraphQLProduct[];
    };
  };
  errors?: Array<{ message: string }>;
}

interface FetchResult {
  key: string;
  products: GraphQLProduct[];
  error: string | null;
}

interface CategoryNode {
  id: number;
  name: string;
  slug: string;
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

interface ActiveChip {
  key: string;
  label: string;
  onRemove: () => void;
}

type SortKey = "default" | "price-asc" | "price-desc" | "name-asc";

/* ============================================================
   CONSTANTS
   ============================================================ */
const API_URL: string =
  process.env.NEXT_PUBLIC_WORDPRESS_API_URL || "https://backend.shophope.online/graphql";

const PRODUCTS_QUERY: string = `
  query GetShopProducts($term: String) {
    products(first: 100, where: { search: $term }) {
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
          variations(first: 100) {
            nodes {
              id
              databaseId
              name
              price
              regularPrice
              ... on InventoriedProduct {
                stockStatus
              }
              ... on ProductVariation {
                purchasable
              }
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
        ... on ProductWithAttributes {
          attributes {
            nodes {
              name
              options
            }
          }
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
        productTags {
          nodes {
            name
            slug
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
  { value: "name-asc", label: "Name: A to Z" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
];

const EMPTY_FILTERS: FilterState = {
  categoryId: null,
  price: { min: "", max: "" },
  onSale: false,
  colors: [],
  sizes: [],
};

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

function hasProductVariations(product: GraphQLProduct): boolean {
  return (product.variations?.nodes?.length ?? 0) > 0;
}

function formatAttributeLabel(raw: string): string {
  const cleaned = raw.replace(/[-_]+/g, " ").trim();
  if (cleaned.length <= 3 && cleaned === cleaned.toLowerCase()) {
    return cleaned.toUpperCase();
  }
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function countActiveFilters(filters: FilterState): number {
  let count = 0;
  if (filters.categoryId !== null) count += 1;
  if (filters.price.min !== "" || filters.price.max !== "") count += 1;
  if (filters.onSale) count += 1;
  count += filters.colors.length;
  count += filters.sizes.length;
  return count;
}

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
    slug: cat.slug,
    count: collectProductIds(cat.databaseId).size,
    children: (childrenByParent.get(cat.databaseId) ?? [])
      .map(toNode)
      .sort((a, b) => a.name.localeCompare(b.name)),
  });

  return roots.map(toNode).sort((a, b) => a.name.localeCompare(b.name));
}

function collectCategoryIds(node: CategoryNode): number[] {
  return [node.id, ...node.children.flatMap(collectCategoryIds)];
}

function findCategoryName(tree: CategoryNode[], targetId: number | null): string | null {
  if (targetId === null) return null;
  for (const node of tree) {
    if (node.id === targetId) return node.name;
    const foundChild = findCategoryName(node.children, targetId);
    if (foundChild) return foundChild;
  }
  return null;
}

function isColorAttributeName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("color") || n.includes("colour");
}

function isSizeAttributeName(name: string): boolean {
  const n = name.toLowerCase();
  return n.includes("size");
}

function extractAttributeOptions(
  products: GraphQLProduct[],
  matcher: (attrName: string) => boolean
): string[] {
  const set = new Set<string>();
  for (const product of products) {
    for (const attr of product.attributes?.nodes ?? []) {
      if (!attr?.name || !matcher(attr.name)) continue;
      for (const opt of attr.options ?? []) {
        const clean = opt.trim();
        if (clean) set.add(clean);
      }
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function productMatchesAttributeGroup(
  product: GraphQLProduct,
  selectedValues: string[],
  matcher: (attrName: string) => boolean
): boolean {
  if (selectedValues.length === 0) return true;
  const groupOptions = (product.attributes?.nodes ?? [])
    .filter((attr) => attr?.name && matcher(attr.name))
    .flatMap((attr) => attr.options ?? [])
    .map((opt) => opt.toLowerCase().trim());

  if (groupOptions.length === 0) return false;

  return selectedValues.some((val) => groupOptions.includes(val.toLowerCase().trim()));
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

function FilterIcon(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18" />
      <path d="M6 12h12" />
      <path d="M10 19h4" />
    </svg>
  );
}

function CloseIcon(): ReactNode {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function UpArrowIcon(): ReactNode {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m18 15-6-6-6 6" />
    </svg>
  );
}

/* ============================================================
   LAYOUT COMPONENTS
   ============================================================ */
function PageBanner({ title }: { title: string }): ReactNode {
  return (
    <section className="bg-[#f8f9fa] border-b border-[#e9ecef]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <nav aria-label="Breadcrumb" className="text-xs sm:text-sm text-[#6c757d] mb-1.5">
          <Link href="/" className="hover:text-[#e91e63] transition-colors">
            Home
          </Link>
          <span className="mx-2">/</span>
          <span className="text-[#212529] font-medium">{title}</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl lg:text-[36px] font-bold tracking-tight text-[#212529]">
          {title}
        </h1>
      </div>
    </section>
  );
}

function SidebarSection({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div className="py-4 border-b border-[#e9ecef] last:border-b-0">
      <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#212529] mb-3">
        {title}
      </h3>
      {children}
    </div>
  );
}

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
    `flex-1 min-w-0 text-left py-1.5 text-[13.5px] transition-colors hover:text-[#e91e63] ${
      active ? "text-[#e91e63] font-semibold" : "text-[#495057]"
    }`;

  return (
    <ul className="text-[13.5px]">
      <li>
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`${itemClass(selectedId === null)} w-full flex items-center justify-between gap-2`}
        >
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
              <ul className="ml-3 pl-3 border-l border-[#e9ecef] mb-1">
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
            className="text-[12.5px] font-semibold text-[#e91e63] hover:text-[#c2185b] transition-colors"
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
  availableColors: string[];
  availableSizes: string[];
  value: FilterState;
  onChange: (next: FilterState) => void;
  showPriceApplyButton: boolean;
  onApplyPrice?: () => void;
}

function FiltersPanel({
  categoryTree,
  totalProducts,
  availableColors,
  availableSizes,
  value,
  onChange,
  showPriceApplyButton,
  onApplyPrice,
}: FiltersPanelProps): ReactNode {
  const toggleInList = (list: string[], item: string): string[] =>
    list.includes(item) ? list.filter((v) => v !== item) : [...list, item];

  return (
    <div className="w-full bg-white rounded-xl border border-[#e9ecef] p-4">
      <SidebarSection title="Categories">
        <CategoryList
          tree={categoryTree}
          totalProducts={totalProducts}
          selectedId={value.categoryId}
          onSelect={(id) => onChange({ ...value, categoryId: id })}
        />
      </SidebarSection>

      <SidebarSection title="Price (KD)">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            placeholder="Min"
            aria-label="Minimum price"
            value={value.price.min}
            onChange={(e) => onChange({ ...value, price: { ...value.price, min: e.target.value } })}
            className="w-full h-10 px-3 border border-[#dee2e6] rounded-lg text-sm focus:outline-none focus:border-[#e91e63]"
          />
          <input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            placeholder="Max"
            aria-label="Maximum price"
            value={value.price.max}
            onChange={(e) => onChange({ ...value, price: { ...value.price, max: e.target.value } })}
            className="w-full h-10 px-3 border border-[#dee2e6] rounded-lg text-sm focus:outline-none focus:border-[#e91e63]"
          />
        </div>
        {showPriceApplyButton && (
          <button
            type="button"
            onClick={onApplyPrice}
            className="mt-2.5 w-full h-9 bg-[#212529] hover:bg-[#e91e63] text-white text-xs font-semibold uppercase tracking-wider rounded-lg transition-colors"
          >
            Apply price
          </button>
        )}
      </SidebarSection>

      {availableColors.length > 0 && (
        <SidebarSection title="Color">
          <ul className="space-y-1 text-[13.5px] text-[#495057] max-h-60 overflow-y-auto py-1 pr-1">
            {availableColors.map((color) => (
              <li key={color}>
                <label className="flex items-center gap-2.5 cursor-pointer py-1.5 px-1.5 rounded-md hover:bg-[#f8f9fa] hover:text-[#212529]">
                  <input
                    type="checkbox"
                    checked={value.colors.includes(color)}
                    onChange={() => onChange({ ...value, colors: toggleInList(value.colors, color) })}
                    className="w-4 h-4 shrink-0 rounded accent-[#e91e63]"
                  />
                  <span className="truncate">{formatAttributeLabel(color)}</span>
                </label>
              </li>
            ))}
          </ul>
        </SidebarSection>
      )}

      {availableSizes.length > 0 && (
        <SidebarSection title="Size">
          <div className="flex flex-wrap gap-1.5">
            {availableSizes.map((size) => {
              const active = value.sizes.includes(size);
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => onChange({ ...value, sizes: toggleInList(value.sizes, size) })}
                  className={`h-8 px-3 rounded-md text-xs font-semibold border transition-colors ${
                    active
                      ? "bg-[#e91e63] border-[#e91e63] text-white"
                      : "bg-white border-[#dee2e6] text-[#495057] hover:border-[#e91e63] hover:text-[#e91e63]"
                  }`}
                >
                  {formatAttributeLabel(size)}
                </button>
              );
            })}
          </div>
        </SidebarSection>
      )}

      <SidebarSection title="Offers & Stock">
        <label className="flex items-center gap-2.5 cursor-pointer py-1.5 px-1.5 rounded-md hover:bg-[#f8f9fa] text-[13.5px] text-[#495057]">
          <input
            type="checkbox"
            checked={value.onSale}
            onChange={(e) => onChange({ ...value, onSale: e.target.checked })}
            className="w-4 h-4 shrink-0 rounded accent-[#e91e63]"
          />
          <span>On sale only</span>
        </label>
      </SidebarSection>
    </div>
  );
}

interface MobileFilterSheetProps {
  open: boolean;
  onClose: () => void;
  categoryTree: CategoryNode[];
  totalProducts: number;
  availableColors: string[];
  availableSizes: string[];
  applied: FilterState;
  onApply: (next: FilterState) => void;
}

function MobileFilterSheet({
  open,
  onClose,
  categoryTree,
  totalProducts,
  availableColors,
  availableSizes,
  applied,
  onApply,
}: MobileFilterSheetProps): ReactNode {
  const [draft, setDraft] = useState<FilterState>(applied);
  const [wasOpen, setWasOpen] = useState<boolean>(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setDraft(applied);
  }

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
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className={`absolute inset-x-0 bottom-0 flex flex-col max-h-[88vh] bg-[#f8f9fa] rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 h-14 bg-white rounded-t-2xl border-b border-[#e9ecef] shrink-0">
          <h2 className="text-[16px] font-bold text-[#212529]">
            Filters{draftCount > 0 ? ` (${draftCount})` : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close filters"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-[#212529] hover:text-[#e91e63] transition-colors"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-4">
          <FiltersPanel
            categoryTree={categoryTree}
            totalProducts={totalProducts}
            availableColors={availableColors}
            availableSizes={availableSizes}
            value={draft}
            onChange={setDraft}
            showPriceApplyButton={false}
          />
        </div>

        <div className="shrink-0 flex items-center gap-3 px-4 py-3.5 border-t border-[#e9ecef] bg-white">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            disabled={draftCount === 0}
            className="h-11 px-4 border border-[#dee2e6] rounded-lg text-[13px] font-semibold uppercase text-[#212529] hover:border-[#e91e63] hover:text-[#e91e63] disabled:opacity-40 transition-colors"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
            className="flex-1 h-11 bg-[#e91e63] hover:bg-[#c2185b] active:scale-[0.98] text-white text-[13px] font-semibold uppercase rounded-lg transition-all"
          >
            Show results
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SHOP PRODUCT CARD
   ============================================================ */
interface ShopProductCardProps {
  product: GraphQLProduct;
  isWishlisted: boolean;
  onToggleWishlist: (product: GraphQLProduct) => void;
  onAdd: (product: GraphQLProduct) => void;
  onBuyNow: (product: GraphQLProduct) => void;
}

function ShopProductCard({
  product,
  isWishlisted,
  onToggleWishlist,
  onAdd,
  onBuyNow,
}: ShopProductCardProps): ReactNode {
  const categoryName: string =
    product.productCategories?.nodes?.map((n) => n.name).join(" · ") || "Featured";
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
        <p className="text-[11px] font-medium text-[#6c757d] truncate" title={categoryName}>
          {categoryName}
        </p>

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
    <nav aria-label="Pagination" className="mt-10 flex justify-center items-center gap-1.5 sm:gap-2">
      {Array.from({ length: pageCount }).map((_, i) => {
        const n: number = i + 1;
        const active: boolean = n === page;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-current={active ? "page" : undefined}
            className={`w-10 h-10 text-sm font-semibold rounded-lg border transition-colors ${
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
   ============================================================ */
function ShopContent(): ReactNode {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchTerm: string = (searchParams.get("search") ?? "").trim();
  const categorySlugParam: string = (searchParams.get("category") ?? "").trim().toLowerCase();
  const tagSlugParam: string = (searchParams.get("tag") ?? "").trim().toLowerCase();
  const isSearching: boolean = searchTerm !== "";

  const [reloadKey, setReloadKey] = useState<number>(0);

  const requestKey: string = `${searchTerm}|${reloadKey}`;
  const [result, setResult] = useState<FetchResult | null>(null);
  const loading: boolean = result === null || result.key !== requestKey;
  const products: GraphQLProduct[] = !loading && result ? result.products : NO_PRODUCTS;
  const error: string | null = !loading && result ? result.error : null;

  const [toast, setToast] = useState<string | null>(null);
  const [wishlist, setWishlist] = useState<string[]>([]);

  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [sheetOpen, setSheetOpen] = useState<boolean>(false);
  const [showScrollTop, setShowScrollTop] = useState<boolean>(false);

  const [quickSelectProduct, setQuickSelectProduct] = useState<GraphQLProduct | null>(null);
  const [quickSelectAction, setQuickSelectAction] = useState<QuickSelectAction | null>(null);

  const [sort, setSort] = useState<SortKey>("default");
  const [page, setPage] = useState<number>(1);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [desktopPriceDraft, setDesktopPriceDraft] = useState<PriceRange>({ min: "", max: "" });

  const [prevSearchTerm, setPrevSearchTerm] = useState<string>(searchTerm);
  if (searchTerm !== prevSearchTerm) {
    setPrevSearchTerm(searchTerm);
    setFilters(EMPTY_FILTERS);
    setDesktopPriceDraft({ min: "", max: "" });
  }

  useEffect(() => {
    const onScroll = (): void => setShowScrollTop(window.scrollY > 500);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const openFromBottomBar = (): void => setSheetOpen(true);
    window.addEventListener(SHOP_OPEN_FILTERS_EVENT, openFromBottomBar);
    return () => window.removeEventListener(SHOP_OPEN_FILTERS_EVENT, openFromBottomBar);
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

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const categoryTree: CategoryNode[] = useMemo(() => buildCategoryTree(products), [products]);
  const availableColors: string[] = useMemo(
    () => extractAttributeOptions(products, isColorAttributeName),
    [products]
  );
  const availableSizes: string[] = useMemo(
    () => extractAttributeOptions(products, isSizeAttributeName),
    [products]
  );

  useEffect(() => {
    if (!categorySlugParam || products.length === 0) return;
    for (const product of products) {
      const match = (product.productCategories?.nodes ?? []).find(
        (c) => c.slug.toLowerCase() === categorySlugParam
      );
      if (match) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFilters((prev) =>
          prev.categoryId === match.databaseId ? prev : { ...prev, categoryId: match.databaseId }
        );
        break;
      }
    }
  }, [categorySlugParam, products]);

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
      if (
        tagSlugParam &&
        !(p.productTags?.nodes ?? []).some((t) => t.slug.toLowerCase() === tagSlugParam)
      ) {
        return false;
      }
      if (filters.onSale && getDiscountPercent(p.price, p.regularPrice) === null) return false;
      if (!productMatchesAttributeGroup(p, filters.colors, isColorAttributeName)) return false;
      if (!productMatchesAttributeGroup(p, filters.sizes, isSizeAttributeName)) return false;
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
  }, [products, filters, selectedCategoryIds, tagSlugParam, sort]);

  const resetKey: string = `${sort}|${searchTerm}|${tagSlugParam}|${JSON.stringify(filters)}|${filtered.length}`;
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

  const activeChips: ActiveChip[] = useMemo(() => {
    const chips: ActiveChip[] = [];
    const catName = findCategoryName(categoryTree, filters.categoryId);
    if (catName) {
      chips.push({
        key: "category",
        label: `Category: ${catName}`,
        onRemove: () => {
          setFilters((prev) => ({ ...prev, categoryId: null }));
          if (categorySlugParam) router.push("/shop");
        },
      });
    }
    if (tagSlugParam) {
      chips.push({
        key: "tag",
        label: `Tag: ${tagSlugParam}`,
        onRemove: () => router.push("/shop"),
      });
    }
    if (filters.price.min !== "" || filters.price.max !== "") {
      const minLabel = filters.price.min !== "" ? `KD ${filters.price.min}` : "Any";
      const maxLabel = filters.price.max !== "" ? `KD ${filters.price.max}` : "Any";
      chips.push({
        key: "price",
        label: `Price: ${minLabel} – ${maxLabel}`,
        onRemove: () => {
          setFilters((prev) => ({ ...prev, price: { min: "", max: "" } }));
          setDesktopPriceDraft({ min: "", max: "" });
        },
      });
    }
    if (filters.onSale) {
      chips.push({
        key: "sale",
        label: "On sale",
        onRemove: () => setFilters((prev) => ({ ...prev, onSale: false })),
      });
    }
    for (const c of filters.colors) {
      chips.push({
        key: `color-${c}`,
        label: `Color: ${formatAttributeLabel(c)}`,
        onRemove: () =>
          setFilters((prev) => ({ ...prev, colors: prev.colors.filter((item) => item !== c) })),
      });
    }
    for (const s of filters.sizes) {
      chips.push({
        key: `size-${s}`,
        label: `Size: ${formatAttributeLabel(s)}`,
        onRemove: () =>
          setFilters((prev) => ({ ...prev, sizes: prev.sizes.filter((item) => item !== s) })),
      });
    }
    return chips;
  }, [categoryTree, filters, categorySlugParam, tagSlugParam, router]);

  const activeFilterCount: number = activeChips.length;

  const handleDesktopChange = (next: FilterState): void => {
    setDesktopPriceDraft(next.price);
    setFilters({ ...next, price: filters.price });
  };

  const handleDesktopApplyPrice = (): void => {
    setFilters((prev) => ({ ...prev, price: desktopPriceDraft }));
  };

  const handleMobileApply = (next: FilterState): void => {
    setFilters(next);
    setDesktopPriceDraft(next.price);
  };

  const handleClearAll = (): void => {
    setFilters(EMPTY_FILTERS);
    setDesktopPriceDraft({ min: "", max: "" });
    if (categorySlugParam || tagSlugParam) {
      router.push("/shop");
    }
  };

  const executeAddWithId = (
    slug: string,
    itemId: string,
    itemName: string,
    image: string | null,
    unitPrice: number
  ): void => {
    addToCart({
      id: itemId,
      slug,
      name: itemName,
      image,
      price: unitPrice,
    });
    setToast(`Added: ${itemName}`);
  };

  const executeBuyNowWithId = (
    slug: string,
    itemId: string,
    itemName: string,
    image: string | null,
    unitPrice: number
  ): void => {
    const expressItem: CartItem = {
      id: itemId,
      slug,
      name: itemName,
      image,
      price: unitPrice,
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

  const handleAddToCart = (product: GraphQLProduct): void => {
    if (hasProductVariations(product)) {
      setQuickSelectProduct(product);
      setQuickSelectAction("cart");
      return;
    }
    executeAddWithId(
      product.slug,
      String(product.databaseId),
      product.name,
      product.image?.sourceUrl ?? null,
      parseAmount(product.price) ?? 0
    );
  };

  const handleBuyNow = (product: GraphQLProduct): void => {
    if (hasProductVariations(product)) {
      setQuickSelectProduct(product);
      setQuickSelectAction("buy_now");
      return;
    }
    const price = parseAmount(product.price);
    if (price === null) return;
    executeBuyNowWithId(
      product.slug,
      String(product.databaseId),
      product.name,
      product.image?.sourceUrl ?? null,
      price
    );
  };

  const handleQuickSelectConfirm = ({
    product,
    variation,
    unitPrice,
    action,
  }: {
    product: QuickSelectProduct;
    variation: QuickSelectVariation;
    unitPrice: number;
    action: QuickSelectAction;
  }): void => {
    const variationIdStr = String(variation.databaseId);
    const fullName = `${product.name} — ${variation.name}`;
    const imgUrl = variation.image?.sourceUrl || product.image?.sourceUrl || null;

    setQuickSelectProduct(null);
    setQuickSelectAction(null);

    if (action === "buy_now") {
      executeBuyNowWithId(product.slug, variationIdStr, fullName, imgUrl, unitPrice);
    } else {
      executeAddWithId(product.slug, variationIdStr, fullName, imgUrl, unitPrice);
    }
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

  const bannerTitle = categorySlugParam
    ? categorySlugParam.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
    : "Shop";

  return (
    <>
      <PageBanner title={bannerTitle} />

      <section className="bg-white py-6 sm:py-8">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`grid gap-7 lg:gap-8 ${showSidebar ? "lg:grid-cols-[260px_1fr]" : "grid-cols-1"}`}>
            {showSidebar && (
              <aside className="hidden lg:block" aria-label="Product filters">
                <div className="lg:sticky lg:top-24">
                  <FiltersPanel
                    categoryTree={categoryTree}
                    totalProducts={products.length}
                    availableColors={availableColors}
                    availableSizes={availableSizes}
                    value={{ ...filters, price: desktopPriceDraft }}
                    onChange={handleDesktopChange}
                    showPriceApplyButton
                    onApplyPrice={handleDesktopApplyPrice}
                  />
                </div>
              </aside>
            )}

            <div className="min-w-0">
              {isSearching && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-[#f8f9fa] border border-[#e9ecef] px-4 py-3 rounded-xl">
                  <p className="text-sm text-[#495057]">
                    Search results for{" "}
                    <span className="font-semibold text-[#212529]">&quot;{searchTerm}&quot;</span>
                  </p>
                  <Link
                    href="/shop"
                    className="text-xs font-semibold uppercase tracking-wide text-[#e91e63] hover:text-[#c2185b] transition-colors"
                  >
                    Clear search
                  </Link>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-[#e9ecef]">
                <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                  <button
                    type="button"
                    onClick={() => setSheetOpen(true)}
                    aria-haspopup="dialog"
                    className="lg:hidden h-10 px-3.5 inline-flex items-center gap-2 border border-[#dee2e6] bg-white text-xs font-semibold uppercase tracking-wide rounded-lg hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
                  >
                    <FilterIcon />
                    Filters
                    {activeFilterCount > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#e91e63] text-white text-[10px] font-bold flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSidebar((prev) => !prev)}
                    className="hidden lg:inline-flex h-10 px-3.5 items-center border border-[#dee2e6] bg-white text-xs font-semibold uppercase tracking-wide rounded-lg hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
                  >
                    {showSidebar ? "Hide filters" : "Show filters"}
                  </button>

                  <p className="text-xs sm:text-sm text-[#6c757d]">
                    {loading
                      ? "Loading products..."
                      : `Showing ${rangeStart}–${rangeEnd} of ${filtered.length} products`}
                  </p>
                </div>

                <select
                  aria-label="Sort products"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  className="h-10 px-3 border border-[#dee2e6] rounded-lg text-xs sm:text-sm bg-white text-[#212529] focus:outline-none focus:border-[#e91e63]"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {activeChips.length > 0 && (
                <div className="mb-5 flex flex-wrap items-center gap-2">
                  {activeChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onRemove}
                      className="h-8 px-3 inline-flex items-center gap-1.5 rounded-full bg-[#f8f9fa] border border-[#dee2e6] text-xs font-medium text-[#212529] hover:border-[#e91e63] hover:text-[#e91e63] transition-colors"
                    >
                      <span>{chip.label}</span>
                      <span aria-hidden="true" className="text-[#6c757d]">
                        ×
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="h-8 px-2.5 text-xs font-semibold text-[#e91e63] hover:text-[#c2185b] transition-colors"
                  >
                    Clear all
                  </button>
                </div>
              )}

              {loading && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5" aria-busy="true">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-[340px] sm:h-[410px] rounded-xl bg-[#f8f9fa] border border-[#e9ecef] animate-pulse"
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
                    onClick={() => setReloadKey((k) => k + 1)}
                    className="mt-5 bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && filtered.length === 0 && (
                <div className="text-center py-12 px-4 bg-[#f8f9fa] border border-[#e9ecef] rounded-xl">
                  <p className="text-sm text-[#495057] font-medium">
                    No products match your selected filters.
                  </p>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="mt-4 h-10 px-5 bg-[#e91e63] hover:bg-[#c2185b] text-white text-xs font-semibold uppercase tracking-wide rounded-lg transition-colors"
                  >
                    Reset filters
                  </button>
                </div>
              )}

              {!loading && !error && pageItems.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-5">
                  {pageItems.map((product) => (
                    <ShopProductCard
                      key={product.id}
                      product={product}
                      isWishlisted={wishlist.includes(product.id)}
                      onToggleWishlist={handleToggleWishlist}
                      onAdd={handleAddToCart}
                      onBuyNow={handleBuyNow}
                    />
                  ))}
                </div>
              )}

              <Pagination page={currentPage} pageCount={pageCount} onChange={setPage} />
            </div>
          </div>
        </div>
      </section>

      <QuickSelectModal
        product={quickSelectProduct}
        action={quickSelectAction}
        onClose={() => {
          setQuickSelectProduct(null);
          setQuickSelectAction(null);
        }}
        onConfirm={handleQuickSelectConfirm}
      />

      <MobileFilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        categoryTree={categoryTree}
        totalProducts={products.length}
        availableColors={availableColors}
        availableSizes={availableSizes}
        applied={filters}
        onApply={handleMobileApply}
      />

      {showScrollTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Scroll to top"
          className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-40 w-10 h-10 rounded-full bg-white border border-[#dee2e6] text-[#212529] hover:bg-[#e91e63] hover:text-white hover:border-[#e91e63] shadow-md inline-flex items-center justify-center transition-colors"
        >
          <UpArrowIcon />
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

export default function ShopPage(): ReactNode {
  return (
    <Suspense fallback={null}>
      <ShopContent />
    </Suspense>
  );
}