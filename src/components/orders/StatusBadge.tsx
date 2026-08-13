import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/domain/status";

const LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  partially_paid: "Partially paid",
  paid: "Paid",
  overdue: "Overdue",
};

const TONE: Record<OrderStatus, "gray" | "blue" | "green" | "red"> = {
  pending: "gray",
  partially_paid: "blue",
  paid: "green",
  overdue: "red",
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <Badge tone={TONE[status]}>{LABEL[status]}</Badge>;
}
