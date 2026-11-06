// app/product/[slug]/page.tsx
// Server Component (no "use client"): static shell + Suspense boundary
import { Suspense } from "react";
import ProductClient from "./product-client";

export default function ProductPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading product...</div>}>
      <ProductClient />
    </Suspense>
  );
}
