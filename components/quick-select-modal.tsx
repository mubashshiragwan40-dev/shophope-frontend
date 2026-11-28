// components/quick-select-modal.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { formatKD } from "@/lib/cart";

export interface QuickSelectVariationAttr {
  name: string;
  value: string;
}

export interface QuickSelectVariation {
  id: string;
  databaseId: number;
  name: string;
  price: string | null;
  regularPrice: string | null;
  stockStatus?: string | null;
  purchasable?: boolean | null;
  image?: { sourceUrl: string } | null;
  attributes?: { nodes: QuickSelectVariationAttr[] } | null;
}

export interface QuickSelectProduct {
  id: string;
  databaseId: number;
  name: string;
  slug: string;
  price: string | null;
  regularPrice: string | null;
  image: { sourceUrl: string } | null;
  variations?: { nodes: QuickSelectVariation[] } | null;
}

export type QuickSelectAction = "cart" | "buy_now";

interface QuickSelectModalProps {
  product: QuickSelectProduct | null;
  action: QuickSelectAction | null;
  onClose: () => void;
  onConfirm: (selection: {
    product: QuickSelectProduct;
    variation: QuickSelectVariation;
    unitPrice: number;
    action: QuickSelectAction;
  }) => void;
}

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

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/^pa_/, "").replace(/[-_]+/g, " ");
}

function normalizeVal(val: string): string {
  return val.trim().toLowerCase().replace(/[-_]+/g, " ");
}

function isColorAttr(name: string): boolean {
  const k = normalizeKey(name);
  return k === "color" || k === "colour" || k.includes("color") || k.includes("colour");
}

function isVariationAvailable(v: QuickSelectVariation): boolean {
  if (v.purchasable === false) return false;
  if (v.stockStatus && v.stockStatus.trim().toUpperCase() === "OUT_OF_STOCK") {
    return false;
  }
  return true;
}

function variationMatchesAttr(
  v: QuickSelectVariation,
  attrName: string,
  expectedVal: string
): boolean {
  const targetKey = normalizeKey(attrName);
  const targetVal = normalizeVal(expectedVal);
  const nodes = v.attributes?.nodes ?? [];
  const found = nodes.find((a) => normalizeKey(a.name) === targetKey);
  if (!found || !found.value) return false;
  const raw = found.value.trim();
  if (raw === "") return true;
  return normalizeVal(raw) === targetVal;
}

function formatLabel(raw: string): string {
  const cleaned = raw.replace(/[-_]+/g, " ").trim();
  if (cleaned.length <= 3 && cleaned === cleaned.toLowerCase()) {
    return cleaned.toUpperCase();
  }
  return cleaned.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export default function QuickSelectModal({
  product,
  action,
  onClose,
  onConfirm,
}: QuickSelectModalProps): ReactNode {
  const [selectedAttrs, setSelectedAttrs] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  const availableVariations: QuickSelectVariation[] = useMemo(
    () => (product?.variations?.nodes ?? []).filter(isVariationAvailable),
    [product]
  );

  const attributeNames: string[] = useMemo(() => {
    const names: string[] = [];
    const seen = new Set<string>();
    for (const v of availableVariations) {
      for (const attr of v.attributes?.nodes ?? []) {
        if (!attr.name) continue;
        const key = normalizeKey(attr.name);
        if (!seen.has(key)) {
          seen.add(key);
          names.push(attr.name);
        }
      }
    }
    return names.sort((a, b) => (isColorAttr(a) ? 0 : 1) - (isColorAttr(b) ? 0 : 1));
  }, [availableVariations]);

  const attributeGroups: Array<{ name: string; options: string[] }> = useMemo(() => {
    return attributeNames.map((groupName) => {
      const options: string[] = [];
      const seenVal = new Set<string>();

      for (const v of availableVariations) {
        const matchesOtherSelected = Object.entries(selectedAttrs).every(
          ([otherName, chosenVal]) => {
            if (!chosenVal) return true;
            if (normalizeKey(otherName) === normalizeKey(groupName)) return true;
            return variationMatchesAttr(v, otherName, chosenVal);
          }
        );

        if (!matchesOtherSelected) continue;

        const targetKey = normalizeKey(groupName);
        const attr = (v.attributes?.nodes ?? []).find(
          (a) => normalizeKey(a.name) === targetKey
        );
        const rawVal = attr?.value?.trim();
        if (!rawVal) continue;

        const normVal = normalizeVal(rawVal);
        if (!seenVal.has(normVal)) {
          seenVal.add(normVal);
          options.push(rawVal);
        }
      }

      return { name: groupName, options };
    });
  }, [availableVariations, attributeNames, selectedAttrs]);

  // Reset or auto-select sensible defaults when modal opens for a product
  useEffect(() => {
    if (!product || !action) return;
    setValidationError(null);

    const initial: Record<string, string> = {};
    for (const group of attributeGroups) {
      if (isColorAttr(group.name) && group.options.length === 1) {
        initial[group.name] = group.options[0];
      }
    }
    setSelectedAttrs(initial);
  }, [product?.id, action]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear invalid selected options when color changes
  useEffect(() => {
    if (attributeGroups.length === 0) return;
    setSelectedAttrs((prev) => {
      let changed = false;
      const next: Record<string, string> = { ...prev };
      for (const group of attributeGroups) {
        const cur = next[group.name];
        if (!cur) continue;
        const stillValid = group.options.some(
          (opt) => normalizeVal(opt) === normalizeVal(cur)
        );
        if (!stillValid) {
          delete next[group.name];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [attributeGroups]);

  useEffect(() => {
    if (!product || !action) return;
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [product, action, onClose]);

  const matchedVariation: QuickSelectVariation | null = useMemo(() => {
    if (availableVariations.length === 0) return null;
    if (attributeGroups.length === 0) return availableVariations[0] ?? null;

    return (
      availableVariations.find((v) =>
        attributeGroups.every((group) => {
          const chosen = selectedAttrs[group.name];
          if (!chosen) return false;
          return variationMatchesAttr(v, group.name, chosen);
        })
      ) ?? null
    );
  }, [availableVariations, attributeGroups, selectedAttrs]);

  if (!product || !action) return null;

  const displayImage = matchedVariation?.image?.sourceUrl || product.image?.sourceUrl || null;
  const displayPriceNum =
    parseAmount(matchedVariation?.price) ?? parseAmount(product.price) ?? 0;

  const handleConfirmClick = (): void => {
    if (!matchedVariation) {
      setValidationError("Please select Colour and Size to continue.");
      return;
    }
    setValidationError(null);
    onConfirm({
      product,
      variation: matchedVariation,
      unitPrice: displayPriceNum,
      action,
    });
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Select options for ${product.name}`}
    >
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-[1px] transition-opacity"
      />

      <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl border border-[#e9ecef] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#e9ecef]">
          <h2 className="text-sm sm:text-base font-bold text-[#212529]">
            {action === "buy_now" ? "Quick Buy Now — Select Option" : "Quick Add — Select Option"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick select modal"
            className="w-8 h-8 rounded-full inline-flex items-center justify-center text-[#495057] hover:bg-[#f8f9fa] hover:text-[#e91e63]"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-16 rounded-xl bg-[#f8f9fa] border border-[#e9ecef] overflow-hidden shrink-0">
              {displayImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#212529] line-clamp-2">{product.name}</p>
              <p className="mt-1 text-base font-bold text-[#e91e63]">
                {formatKD(displayPriceNum)}
              </p>
            </div>
          </div>

          {availableVariations.length === 0 ? (
            <p className="text-sm text-[#dc3545] font-medium">
              No in-stock variations available for this item right now.
            </p>
          ) : (
            <div className="space-y-4">
              {attributeGroups.map((group) => {
                const currentVal = selectedAttrs[group.name] ?? "";
                return (
                  <div key={group.name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#212529]">
                        {formatLabel(group.name)}
                        {currentVal ? `: ${formatLabel(currentVal)}` : ""}
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
                          className="text-xs font-medium text-[#6c757d] hover:text-[#e91e63]"
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
                            onClick={() => {
                              setValidationError(null);
                              setSelectedAttrs((prev) => ({
                                ...prev,
                                [group.name]: prev[group.name] === opt ? "" : opt,
                              }));
                            }}
                            aria-pressed={isSelected}
                            className={`h-9 px-3.5 rounded-lg text-xs font-semibold border transition-colors ${
                              isSelected
                                ? "bg-[#212529] border-[#212529] text-white"
                                : "bg-white border-[#dee2e6] text-[#212529] hover:border-[#e91e63] hover:text-[#e91e63]"
                            }`}
                          >
                            {formatLabel(opt)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {validationError && (
            <p role="alert" className="text-xs font-semibold text-[#dc3545]">
              {validationError}
            </p>
          )}
        </div>

        <div className="p-4 sm:px-5 border-t border-[#e9ecef] bg-[#f8f9fa] flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-4 rounded-xl border border-[#dee2e6] bg-white text-xs font-semibold uppercase tracking-wide text-[#212529] hover:border-[#212529]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={!matchedVariation}
            className={`flex-1 h-11 px-4 rounded-xl text-xs font-bold uppercase tracking-wider text-white disabled:opacity-45 transition-colors ${
              action === "buy_now"
                ? "bg-[#e91e63] hover:bg-[#c2185b]"
                : "bg-[#212529] hover:bg-[#e91e63]"
            }`}
          >
            {action === "buy_now"
              ? `Continue to Checkout · ${formatKD(displayPriceNum)}`
              : `Add to Cart · ${formatKD(displayPriceNum)}`}
          </button>
        </div>
      </div>
    </div>
  );
}