"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUSD, toCents } from "@/lib/domain/money";

type LineItemDraft = {
  description: string;
  quantity: string;
  unitPrice: string;
};

const emptyLine = (): LineItemDraft => ({ description: "", quantity: "1", unitPrice: "" });

type Mode =
  | { kind: "create" }
  | {
      kind: "edit";
      orderId: string;
      hasPayments: boolean;
      initial: {
        customer: string;
        dueDate: string;
        notes: string;
        lineItems: (LineItemDraft & { id: string })[];
      };
    };

export function OrderForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isEdit = mode.kind === "edit";
  const locked = isEdit && mode.hasPayments;

  const [customer, setCustomer] = useState(isEdit ? mode.initial.customer : "");
  const [dueDate, setDueDate] = useState(
    isEdit ? mode.initial.dueDate : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState(isEdit ? mode.initial.notes : "");
  const [lines, setLines] = useState<(LineItemDraft & { id?: string })[]>(
    isEdit ? mode.initial.lineItems : [emptyLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const subtotalCents = useMemo(() => {
    return lines.reduce((acc, li) => {
      const qty = Number(li.quantity);
      const price = Number(li.unitPrice);
      if (!Number.isFinite(qty) || !Number.isFinite(price)) return acc;
      return acc + Math.round(qty * price * 100);
    }, 0);
  }, [lines]);

  function updateLine(i: number, patch: Partial<LineItemDraft>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customer.trim()) {
      setError("Customer is required.");
      return;
    }
    if (!dueDate) {
      setError("Due date is required.");
      return;
    }
    if (lines.length === 0) {
      setError("At least one line item is required.");
      return;
    }
    for (const [i, l] of lines.entries()) {
      if (!l.description.trim()) {
        setError(`Line ${i + 1}: description is required.`);
        return;
      }
      const qty = Number(l.quantity);
      if (!Number.isInteger(qty) || qty < 1) {
        setError(`Line ${i + 1}: quantity must be a positive integer.`);
        return;
      }
      const price = Number(l.unitPrice);
      if (!Number.isFinite(price) || price < 0) {
        setError(`Line ${i + 1}: unit price must be non-negative.`);
        return;
      }
    }

    startTransition(async () => {
      if (mode.kind === "create") {
        const payload = {
          customer: customer.trim(),
          dueDate: new Date(dueDate).toISOString(),
          notes: notes.trim() || null,
          lineItems: lines.map((l) => ({
            description: l.description.trim(),
            quantity: Number(l.quantity),
            unitPriceCents: toCents(l.unitPrice),
          })),
        };
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error?.message ?? "Failed to create order.");
          return;
        }
        const body = await res.json();
        toast.success("Order created.");
        router.push(`/orders/${body.order.id}`);
        router.refresh();
      } else {
        const payload: Record<string, unknown> = {
          customer: customer.trim(),
          notes: notes.trim() || null,
        };
        if (!locked) {
          payload.dueDate = new Date(dueDate).toISOString();
          payload.replaceLineItems = true;
          payload.lineItems = lines.map((l) => ({
            description: l.description.trim(),
            quantity: Number(l.quantity),
            unitPriceCents: toCents(l.unitPrice),
          }));
        } else {
          payload.lineItems = lines
            .filter((l) => l.id)
            .map((l) => ({
              id: l.id,
              description: l.description.trim(),
            }));
        }
        const res = await fetch(`/api/orders/${mode.orderId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          setError(body?.error?.message ?? "Failed to update order.");
          return;
        }
        toast.success("Order updated.");
        router.push(`/orders/${mode.orderId}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {locked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          🔒 This order has recorded payments. Money fields (due date, quantity, unit price)
          and adding/removing line items are locked. You can still edit customer name,
          notes, and line item descriptions.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="customer">Customer</Label>
          <Input
            id="customer"
            required
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="dueDate">Due date</Label>
          <Input
            id="dueDate"
            type="date"
            required
            disabled={locked}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          {locked && <p className="mt-1 text-xs text-slate-500">Locked after first payment.</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Input
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Internal notes about this order"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Line items</h2>
          {!locked && (
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              + Add line
            </Button>
          )}
        </div>

        <div className="divide-y divide-slate-200">
          {lines.map((l, i) => (
            <div key={l.id ?? i} className="grid grid-cols-12 gap-3 p-4">
              <div className="col-span-12 sm:col-span-6">
                <Label htmlFor={`desc-${i}`}>Description</Label>
                <Input
                  id={`desc-${i}`}
                  required
                  value={l.description}
                  onChange={(e) => updateLine(i, { description: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-2">
                <Label htmlFor={`qty-${i}`}>Quantity</Label>
                <Input
                  id={`qty-${i}`}
                  type="number"
                  min="1"
                  step="1"
                  required
                  disabled={locked}
                  value={l.quantity}
                  onChange={(e) => updateLine(i, { quantity: e.target.value })}
                />
              </div>
              <div className="col-span-6 sm:col-span-3">
                <Label htmlFor={`price-${i}`}>Unit price</Label>
                <Input
                  id={`price-${i}`}
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  disabled={locked}
                  value={l.unitPrice}
                  onChange={(e) => updateLine(i, { unitPrice: e.target.value })}
                />
              </div>
              <div className="col-span-12 sm:col-span-1 flex items-end justify-end">
                {!locked && lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="h-10 text-sm text-red-600 hover:text-red-800"
                    aria-label={`Remove line ${i + 1}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm text-slate-600">Subtotal</span>
          <span className="text-lg font-semibold tabular-nums text-slate-900">
            {formatUSD(subtotalCents)}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={pending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Save changes" : "Create order"}
        </Button>
      </div>
    </form>
  );
}
