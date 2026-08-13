"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DeleteOrderButton({ orderId, disabled }: { orderId: string; disabled?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    if (!confirm("Delete this order? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await fetch(`/api/orders/${orderId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.error?.message ?? "Failed to delete order.");
        return;
      }
      toast.success("Order deleted.");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <Button variant="outline" onClick={onClick} disabled={disabled || pending}>
      {pending ? "Deleting…" : "Delete"}
    </Button>
  );
}
