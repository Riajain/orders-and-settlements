import { OrderForm } from "@/components/orders/OrderForm";

export default function NewOrderPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New order</h1>
        <p className="mt-1 text-sm text-slate-600">
          Add line items and set the due date. Subtotal updates as you type.
        </p>
      </div>
      <OrderForm mode={{ kind: "create" }} />
    </div>
  );
}
