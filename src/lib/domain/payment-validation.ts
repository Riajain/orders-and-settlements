import { OverpaymentError } from "@/lib/api/errors";

export function assertPaymentAllowed(args: {
  amountCents: number;
  orderTotalCents: number;
  alreadyPaidCents: number;
}): void {
  if (args.amountCents < 1) {
    throw new Error("Payment amount must be at least 1 cent.");
  }
  const remaining = args.orderTotalCents - args.alreadyPaidCents;
  if (args.amountCents > remaining) {
    throw new OverpaymentError({
      maxAllowedCents: Math.max(remaining, 0),
      orderTotalCents: args.orderTotalCents,
      alreadyPaidCents: args.alreadyPaidCents,
      attemptedCents: args.amountCents,
    });
  }
}
