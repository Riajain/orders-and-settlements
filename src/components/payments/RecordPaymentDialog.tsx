"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUSD, toCents } from "@/lib/domain/money";

type Props = {
  orderId: string;
  maxAllowedCents: number;
  disabled?: boolean;
};

export function RecordPaymentDialog({ orderId, maxAllowedCents, disabled }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setAmount("");
    setNote("");
    setDate(new Date().toISOString().slice(0, 10));
    setError(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let amountCents: number;
    try {
      amountCents = toCents(amount);
    } catch {
      setError("Enter a valid amount.");
      return;
    }
    if (amountCents < 1) {
      setError("Amount must be at least 0.01.");
      return;
    }
    if (amountCents > maxAllowedCents) {
      setError(`Amount exceeds remaining balance. Maximum allowed: ${formatUSD(maxAllowedCents)}.`);
      return;
    }

    startTransition(async () => {
      const res = await fetch(`/api/orders/${orderId}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          amountCents,
          paidAt: new Date(date).toISOString(),
          note: note.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Failed to record payment.");
        return;
      }
      toast.success(`Payment of ${formatUSD(amountCents)} recorded.`);
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={disabled || maxAllowedCents === 0}>
        Record payment
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) reset();
        }}
        title="Record a payment"
        description={`Maximum allowed: ${formatUSD(maxAllowedCents)}`}
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              placeholder="e.g. Wire transfer, check #123"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
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
              onClick={() => {
                setOpen(false);
                reset();
              }}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Recording…" : "Record"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
