// app/my-account/orders/[id]/page.tsx
// Server Component (no "use client"). Static shell + Suspense boundary.
import { Suspense } from "react";
import AccountSkeleton from "@/components/account-skeleton";
import OrderDetailClient from "./order-detail-client";

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <OrderDetailClient params={params} />
    </Suspense>
  );
}
