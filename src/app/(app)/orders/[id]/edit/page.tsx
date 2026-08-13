import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { getOrder } from "@/lib/services/orders";
import { NotFoundError } from "@/lib/api/errors";
import { OrderForm } from "@/components/orders/OrderForm";
import { formatCents } from "@/lib/domain/money";

type Props = { params: Promise<{ id: string }> };

export default async function EditOrderPage({ params }: Props) {
  const { id } = await params;
  const userId = await requireUserId();

  let order;
  try {
    order = await getOrder(userId, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Edit order</h1>
        <p className="mt-1 text-sm text-slate-600">{order.customer}</p>
      </div>
      <OrderForm
        mode={{
          kind: "edit",
          orderId: order.id,
          hasPayments: order.payments.length > 0,
          initial: {
            customer: order.customer,
            dueDate: order.dueDate.toISOString().slice(0, 10),
            notes: order.notes ?? "",
            lineItems: order.lineItems.map((li) => ({
              id: li.id,
              description: li.description,
              quantity: String(li.quantity),
              unitPrice: formatCents(li.unitPriceCents),
            })),
          },
        }}
      />
    </div>
  );
}
