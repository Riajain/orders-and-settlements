import { prisma } from "@/lib/prisma";
import { AppError, NotFoundError, OverpaymentError } from "@/lib/api/errors";
import { assertPaymentAllowed } from "@/lib/domain/payment-validation";
import { deriveStatus, type OrderStatus } from "@/lib/domain/status";
import type { CreatePaymentInput } from "@/lib/validators/payment";

const MAX_RETRIES = 8;
const BASE_BACKOFF_MS = 30;
const TX_TIMEOUT_MS = 15_000;

function isRetryable(err: unknown): boolean {
  if (err instanceof AppError) return false;
  if (!err || typeof err !== "object") return false;
  const msg = String((err as { message?: unknown }).message ?? "");
  const code = String((err as { code?: unknown }).code ?? "");
  return (
    msg.includes("SQLITE_BUSY") ||
    msg.includes("database is locked") ||
    msg.includes("Transaction API error") ||
    msg.includes("Operations timed out") ||
    msg.includes("Timed out") ||
    msg.includes("Transaction not found") ||
    code === "SQLITE_BUSY" ||
    code === "P2028" || // Prisma: transaction API error (timeout/lost)
    code === "P2034" // Prisma: write conflict/deadlock
  );
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= MAX_RETRIES || !isRetryable(err)) throw err;
      const jitter = Math.random() * BASE_BACKOFF_MS;
      const backoff = BASE_BACKOFF_MS * 2 ** (attempt - 1) + jitter;
      await new Promise((r) => setTimeout(r, backoff));
    }
  }
}

export type RecordedPayment = {
  payment: {
    id: string;
    orderId: string;
    amountCents: number;
    paidAt: Date;
    note: string | null;
    createdAt: Date;
  };
  order: {
    id: string;
    totalCents: number;
    paidCents: number;
    dueCents: number;
    status: OrderStatus;
  };
};

/**
 * Transactionally record a payment against an order.
 *
 * Concurrency: wrapped in a serializable transaction. Reads SUM(payments)
 * inside the transaction, validates, inserts, then re-reads SUM as a
 * defence-in-depth invariant check. On SQLite the write path is serialized
 * (BEGIN IMMEDIATE) so this maps to correct semantics; on Postgres this
 * should be paired with `SELECT ... FOR UPDATE` on the order row.
 */
export async function recordPayment(
  userId: string,
  orderId: string,
  input: CreatePaymentInput,
): Promise<RecordedPayment> {
  return withRetry(() =>
    prisma.$transaction(
    async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        select: { id: true, totalCents: true },
      });
      if (!order) throw new NotFoundError("Order");

      const aggBefore = await tx.payment.aggregate({
        where: { orderId },
        _sum: { amountCents: true },
      });
      const alreadyPaidCents = aggBefore._sum.amountCents ?? 0;

      assertPaymentAllowed({
        amountCents: input.amountCents,
        orderTotalCents: order.totalCents,
        alreadyPaidCents,
      });

      const payment = await tx.payment.create({
        data: {
          orderId,
          amountCents: input.amountCents,
          paidAt: input.paidAt,
          note: input.note ?? null,
        },
      });

      const aggAfter = await tx.payment.aggregate({
        where: { orderId },
        _sum: { amountCents: true },
      });
      const paidCents = aggAfter._sum.amountCents ?? 0;

      if (paidCents > order.totalCents) {
        throw new OverpaymentError({
          maxAllowedCents: Math.max(order.totalCents - alreadyPaidCents, 0),
          orderTotalCents: order.totalCents,
          alreadyPaidCents,
          attemptedCents: input.amountCents,
        });
      }

      const fullOrder = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        select: { id: true, totalCents: true, dueDate: true },
      });

      return {
        payment: {
          id: payment.id,
          orderId: payment.orderId,
          amountCents: payment.amountCents,
          paidAt: payment.paidAt,
          note: payment.note,
          createdAt: payment.createdAt,
        },
        order: {
          id: fullOrder.id,
          totalCents: fullOrder.totalCents,
          paidCents,
          dueCents: Math.max(fullOrder.totalCents - paidCents, 0),
          status: deriveStatus({
            totalCents: fullOrder.totalCents,
            paidCents,
            dueDate: fullOrder.dueDate,
          }),
        },
      };
    },
      { isolationLevel: "Serializable", timeout: TX_TIMEOUT_MS, maxWait: TX_TIMEOUT_MS },
    ),
  );
}

export async function listPayments(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true },
  });
  if (!order) throw new NotFoundError("Order");

  return prisma.payment.findMany({
    where: { orderId },
    orderBy: { paidAt: "desc" },
  });
}

export async function deletePayment(userId: string, orderId: string, paymentId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: { id: true },
  });
  if (!order) throw new NotFoundError("Order");

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, orderId },
  });
  if (!payment) throw new NotFoundError("Payment");

  await prisma.payment.delete({ where: { id: paymentId } });
}
