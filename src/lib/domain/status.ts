export type OrderStatus = "pending" | "partially_paid" | "paid" | "overdue";

export const ORDER_STATUSES: OrderStatus[] = ["pending", "partially_paid", "paid", "overdue"];

/**
 * Derive order status from payments and due date.
 * Precedence (highest wins): paid > overdue > partially_paid > pending.
 * A fully paid order is `paid` even if it was previously past due.
 */
export function deriveStatus(args: {
  totalCents: number;
  paidCents: number;
  dueDate: Date;
  now?: Date;
}): OrderStatus {
  const now = args.now ?? new Date();

  if (args.paidCents >= args.totalCents && args.totalCents > 0) return "paid";

  const pastDue = now.getTime() > args.dueDate.getTime();
  if (pastDue) return "overdue";

  if (args.paidCents > 0) return "partially_paid";

  return "pending";
}
