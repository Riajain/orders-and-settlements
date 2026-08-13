import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/auth/session";
import { getOrder } from "@/lib/services/orders";
import { NotFoundError } from "@/lib/api/errors";
import { OrderHeader } from "@/components/orders/OrderHeader";
import { LineItemsTable } from "@/components/orders/LineItemsTable";
import { PaymentsTable } from "@/components/payments/PaymentsTable";
import { RecordPaymentDialog } from "@/components/payments/RecordPaymentDialog";
import { DeleteOrderButton } from "@/components/orders/DeleteOrderButton";
import { Button } from "@/components/ui/button";

type Props = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: Props) {
  const { id } = await params;
  const userId = await requireUserId();

  let order;
  try {
    order = await getOrder(userId, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }

  const hasPayments = order.payments.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/dashboard" className="text-sm text-slate-600 hover:text-slate-900">
          ← Back to dashboard
        </Link>
        <div className="flex gap-2">
          <Link href={`/orders/${order.id}/edit`}>
            <Button variant="outline">Edit</Button>
          </Link>
          <DeleteOrderButton orderId={order.id} disabled={hasPayments} />
          <RecordPaymentDialog
            orderId={order.id}
            maxAllowedCents={order.dueCents}
            disabled={order.status === "paid"}
          />
        </div>
      </div>

      <OrderHeader order={order} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <LineItemsTable order={order} />
        <PaymentsTable payments={order.payments} />
      </div>
    </div>
  );
}
