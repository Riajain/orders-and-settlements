import { format } from "date-fns";
import { formatUSD } from "@/lib/domain/money";
import type { OrderDetail } from "@/lib/services/orders";

export function PaymentsTable({ payments }: { payments: OrderDetail["payments"] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Payment history</h2>
      </div>
      {payments.length === 0 ? (
        <div className="px-6 py-12 text-center text-sm text-slate-500">
          No payments recorded yet.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-6 py-3 font-medium">Date</th>
              <th className="px-6 py-3 font-medium">Note</th>
              <th className="px-6 py-3 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {payments.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-3 text-slate-700 tabular-nums">
                  {format(p.paidAt, "MMM d, yyyy")}
                </td>
                <td className="px-6 py-3 text-slate-600">{p.note || "—"}</td>
                <td className="px-6 py-3 text-right tabular-nums font-medium text-slate-900">
                  {formatUSD(p.amountCents)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
