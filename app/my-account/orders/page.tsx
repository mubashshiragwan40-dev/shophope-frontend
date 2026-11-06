// app/my-account/orders/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/auth-guard";
import AccountSkeleton from "@/components/account-skeleton";
import { getOrders, type Order } from "@/lib/auth";
import { GraphQLError } from "@/lib/graphql";
import { formatKD } from "@/lib/cart";
import { toAmount } from "@/lib/money";

const ALERT_ERROR_CLASS =
  "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700";

const LINK_CLASS =
  "rounded text-sm font-medium text-[#e91e63] hover:text-[#c2185b] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]";

export default function OrdersPage() {
  return (
    <AuthGuard>
      <OrdersContent />
    </AuthGuard>
  );
}

function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    getOrders()
      .then((result) => {
        if (!cancelled) setOrders(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof GraphQLError ? err.message : "Could not load orders.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <AccountSkeleton />;

  if (error) {
    return (
      <div role="alert" className={ALERT_ERROR_CLASS}>
        {error}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-[#dee2e6] px-6 py-12 text-center">
        <p className="text-[#6c757d]">You haven&apos;t placed any orders yet.</p>
        <Link href="/shop" className={`${LINK_CLASS} mt-3 inline-block`}>
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <section aria-labelledby="orders-heading">
      <h2
        id="orders-heading"
        className="mb-4 text-xl font-semibold text-[#212529]"
      >
        Order History
      </h2>

      <div className="overflow-x-auto rounded-lg border border-[#dee2e6]">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium text-[#6c757d]">
                Order
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-[#6c757d]">
                Date
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-[#6c757d]">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-medium text-[#6c757d]">
                Total
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f1f5f9]">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-4 py-3 font-medium text-[#212529]">
                  #{order.orderNumber}
                </td>
                <td className="px-4 py-3 text-[#6c757d]">
                  {new Date(order.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium capitalize text-[#212529]">
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-[#212529]">
                  {formatKD(toAmount(order.total))}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/my-account/orders/${order.databaseId}`}
                    className={LINK_CLASS}
                    aria-label={`View order ${order.orderNumber}`}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
