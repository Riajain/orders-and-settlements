import Link from "next/link";
import { format } from "date-fns";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { formatUSD } from "@/lib/domain/money";
import type { OrderSummary } from "@/lib/services/orders";

export function OrderTable({ orders }: { orders: OrderSummary[] }) {
  if (orders.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
        <p className="text-slate-500">No orders match the current filter.</p>
        <Link
          href="/orders/new"
          className="mt-4 inline-block text-sm font-medium text-slate-900 underline"
        >
          Create your first order
        </Link>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Total</th>
            <th className="px-4 py-3 font-medium text-right">Paid</th>
            <th className="px-4 py-3 font-medium text-right">Due</th>
            <th className="px-4 py-3 font-medium">Due date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {orders.map((o) => (
            <tr key={o.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/orders/${o.id}`} className="font-medium text-slate-900 hover:underline">
                  {o.customer}
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={o.status} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{formatUSD(o.totalCents)}</td>
              <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                {formatUSD(o.paidCents)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium">
                {formatUSD(o.dueCents)}
              </td>
              <td className="px-4 py-3 text-slate-600">
                {format(o.dueDate, "MMM d, yyyy")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
