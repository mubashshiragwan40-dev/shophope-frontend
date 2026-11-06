// app/my-account/orders/[id]/order-detail-client.tsx
"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/auth-guard";
import AccountSkeleton from "@/components/account-skeleton";
import { getOrder, type OrderDetail } from "@/lib/auth";
import { GraphQLError } from "@/lib/graphql";
import { formatKD } from "@/lib/cart";
import { toAmount } from "@/lib/money";

const ALERT_ERROR_CLASS =
  "rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700";

const LINK_CLASS =
  "rounded text-sm font-medium text-[#e91e63] hover:text-[#c2185b] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e91e63]";

export default function OrderDetailClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <AuthGuard>
      <OrderDetailContent id={id} />
    </AuthGuard>
  );
}

function OrderDetailContent({ id }: { id: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    // Reset the loading state for the new order id.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");

    getOrder(id)
      .then((result) => {
        if (!cancelled) setOrder(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof GraphQLError ? err.message : "Could not load order.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <AccountSkeleton />;

  if (error || !order) {
    return (
      <div className="space-y-4">
        <Link href="/my-account/orders" className={LINK_CLASS}>
          &larr; Back to orders
        </Link>
        <div role="alert" className={ALERT_ERROR_CLASS}>
          {error || "Order not found."}
        </div>
      </div>
    );
  }

  const lineItems = order.lineItems?.nodes ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/my-account/orders"
          className={`${LINK_CLASS} mb-4 inline-block`}
        >
          &larr; Back to orders
        </Link>
        <h2 className="text-xl font-semibold text-[#212529]">
          Order #{order.orderNumber}
        </h2>
        <p className="mt-1 text-sm text-[#6c757d]">
          Placed on {new Date(order.date).toLocaleDateString()}
        </p>
      </div>

      {/* Summary */}
      <dl className="flex flex-wrap gap-6 rounded-lg border border-[#dee2e6] p-4">
        <div>
          <dt className="text-xs font-medium uppercase text-[#6c757d]">
            Status
          </dt>
          <dd className="mt-0.5 text-sm font-medium capitalize text-[#212529]">
            {order.status}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase text-[#6c757d]">
            Total
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-[#212529]">
            {formatKD(toAmount(order.total))}
          </dd>
        </div>
        {order.paymentMethodTitle && (
          <div>
            <dt className="text-xs font-medium uppercase text-[#6c757d]">
              Payment
            </dt>
            <dd className="mt-0.5 text-sm text-[#212529]">
              {order.paymentMethodTitle}
            </dd>
          </div>
        )}
      </dl>

      {/* Line items */}
      {lineItems.length > 0 && (
        <section aria-labelledby="order-items-heading">
          <h3
            id="order-items-heading"
            className="mb-3 text-lg font-semibold text-[#212529]"
          >
            Items
          </h3>
          <div className="overflow-x-auto rounded-lg border border-[#dee2e6]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-[#6c757d]"
                  >
                    Product
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-[#6c757d]"
                  >
                    Qty
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-3 font-medium text-[#6c757d]"
                  >
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f1f5f9]">
                {lineItems.map((item, index) => (
                  <tr key={item.product?.id ?? `item-${index}`}>
                    <td className="px-4 py-3 text-[#212529]">
                      {item.product?.name || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#6c757d]">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 font-medium text-[#212529]">
                      {formatKD(toAmount(item.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Addresses */}
      <div className="grid gap-6 sm:grid-cols-2">
        {order.billing && (
          <div className="rounded-lg border border-[#dee2e6] p-4">
            <h4 className="mb-2 text-sm font-semibold uppercase text-[#6c757d]">
              Billing Address
            </h4>
            <address className="text-sm not-italic text-[#212529]">
              {order.billing.email && <p>{order.billing.email}</p>}
              {order.billing.phone && <p>{order.billing.phone}</p>}
              {order.billing.address1 && <p>{order.billing.address1}</p>}
              {order.billing.address2 && <p>{order.billing.address2}</p>}
              <p>
                {[
                  order.billing.city,
                  order.billing.state,
                  order.billing.postcode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {order.billing.country && <p>{order.billing.country}</p>}
            </address>
          </div>
        )}
        {order.shipping && (
          <div className="rounded-lg border border-[#dee2e6] p-4">
            <h4 className="mb-2 text-sm font-semibold uppercase text-[#6c757d]">
              Shipping Address
            </h4>
            <address className="text-sm not-italic text-[#212529]">
              {order.shipping.address1 && <p>{order.shipping.address1}</p>}
              {order.shipping.address2 && <p>{order.shipping.address2}</p>}
              <p>
                {[
                  order.shipping.city,
                  order.shipping.state,
                  order.shipping.postcode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              {order.shipping.country && <p>{order.shipping.country}</p>}
            </address>
          </div>
        )}
      </div>
    </div>
  );
}
