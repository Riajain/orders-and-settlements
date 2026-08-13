import { format } from "date-fns";
import { StatusBadge } from "@/components/orders/StatusBadge";
import { formatUSD } from "@/lib/domain/money";
import type { OrderDetail } from "@/lib/services/orders";

export function OrderHeader({ order }: { order: OrderDetail }) {
  const pct = order.totalCents > 0
    ? Math.min(100, Math.round((order.paidCents / order.totalCents) * 100))
    : 0;

  return (
    <div className="space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Customer</p>
          <h1 className="text-2xl font-semibold text-slate-900">{order.customer}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Due {format(order.dueDate, "MMM d, yyyy")}
          </p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Order total" value={formatUSD(order.totalCents)} />
        <Stat label="Paid" value={formatUSD(order.paidCents)} />
        <Stat
          label="Amount due"
          value={formatUSD(order.dueCents)}
          highlight={order.dueCents > 0}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
          <span>Payment progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full transition-all ${
              order.status === "paid" ? "bg-emerald-500" : "bg-blue-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {order.notes && (
        <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
          <p className="mb-1 text-xs uppercase tracking-wide text-slate-500">Notes</p>
          {order.notes}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          highlight ? "text-slate-900" : "text-slate-700"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
