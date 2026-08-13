import Link from "next/link";
import { requireUserId } from "@/lib/auth/session";
import { listOrders } from "@/lib/services/orders";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/domain/status";
import { OrderTable } from "@/components/orders/OrderTable";
import { StatusFilterBar } from "@/components/orders/StatusFilterBar";
import { Button } from "@/components/ui/button";

type Props = {
  searchParams: Promise<{ status?: string }>;
};

export default async function DashboardPage({ searchParams }: Props) {
  const userId = await requireUserId();
  const { status } = await searchParams;
  const filter =
    status && (ORDER_STATUSES as string[]).includes(status)
      ? (status as OrderStatus)
      : undefined;

  const orders = await listOrders(userId, filter);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track outstanding balances and settlement status across all orders.
          </p>
        </div>
        <Link href="/orders/new">
          <Button>+ New order</Button>
        </Link>
      </div>

      <StatusFilterBar />

      <OrderTable orders={orders} />
    </div>
  );
}
