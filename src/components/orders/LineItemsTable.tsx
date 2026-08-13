import { formatUSD } from "@/lib/domain/money";
import type { OrderDetail } from "@/lib/services/orders";

export function LineItemsTable({ order }: { order: OrderDetail }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-sm font-semibold text-slate-900">Line items</h2>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-6 py-3 font-medium">Description</th>
            <th className="px-6 py-3 font-medium text-right">Quantity</th>
            <th className="px-6 py-3 font-medium text-right">Unit price</th>
            <th className="px-6 py-3 font-medium text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {order.lineItems.map((li) => (
            <tr key={li.id}>
              <td className="px-6 py-3 text-slate-900">{li.description}</td>
              <td className="px-6 py-3 text-right tabular-nums text-slate-700">
                {li.quantity}
              </td>
              <td className="px-6 py-3 text-right tabular-nums text-slate-700">
                {formatUSD(li.unitPriceCents)}
              </td>
              <td className="px-6 py-3 text-right tabular-nums font-medium text-slate-900">
                {formatUSD(li.quantity * li.unitPriceCents)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-slate-50">
          <tr>
            <td colSpan={3} className="px-6 py-3 text-right text-sm font-medium text-slate-600">
              Subtotal
            </td>
            <td className="px-6 py-3 text-right tabular-nums font-semibold text-slate-900">
              {formatUSD(order.totalCents)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
