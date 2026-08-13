import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testPrisma, resetDatabase } from "../setup";

vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }));

const { recordPayment } = await import("@/lib/services/payments");
const { createOrder } = await import("@/lib/services/orders");
const { OverpaymentError, NotFoundError } = await import("@/lib/api/errors");

async function createUser(email: string) {
  return testPrisma.user.create({
    data: { email, passwordHash: "unused" },
  });
}

const DAY = 24 * 60 * 60 * 1000;
const inDays = (d: number) => new Date(Date.now() + d * DAY);

describe("payment service — sample scenario from spec", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("$1000 order → pay $400 (partially_paid) → pay $600 (paid) → reject $1", async () => {
    const user = await createUser("scenario@test.com");
    const order = await createOrder(user.id, {
      customer: "Acme",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "Widget", quantity: 2, unitPriceCents: 50_000 }],
    });

    expect(order.totalCents).toBe(100_000);
    expect(order.status).toBe("pending");

    const first = await recordPayment(user.id, order.id, {
      amountCents: 40_000,
      paidAt: new Date(),
      note: null,
    });
    expect(first.order.status).toBe("partially_paid");
    expect(first.order.paidCents).toBe(40_000);
    expect(first.order.dueCents).toBe(60_000);

    const second = await recordPayment(user.id, order.id, {
      amountCents: 60_000,
      paidAt: new Date(),
      note: null,
    });
    expect(second.order.status).toBe("paid");
    expect(second.order.paidCents).toBe(100_000);
    expect(second.order.dueCents).toBe(0);

    try {
      await recordPayment(user.id, order.id, {
        amountCents: 100,
        paidAt: new Date(),
        note: null,
      });
      throw new Error("expected OverpaymentError");
    } catch (e) {
      expect(e).toBeInstanceOf(OverpaymentError);
      const err = e as InstanceType<typeof OverpaymentError>;
      expect(err.details).toMatchObject({
        maxAllowedCents: 0,
        orderTotalCents: 100_000,
        alreadyPaidCents: 100_000,
        attemptedCents: 100,
      });
    }
  });
});

describe("payment service — concurrency", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("10 x $200 concurrent payments on a $1000 order end up as exactly $1000 total", async () => {
    const user = await createUser("concurrency@test.com");
    const order = await createOrder(user.id, {
      customer: "RaceCo",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "Slot", quantity: 1, unitPriceCents: 100_000 }],
    });

    const results = await Promise.allSettled(
      Array.from({ length: 10 }).map(() =>
        recordPayment(user.id, order.id, {
          amountCents: 20_000,
          paidAt: new Date(),
          note: null,
        }),
      ),
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected");
    const failureMessages = failed.map((r) =>
      String((r as PromiseRejectedResult).reason?.message ?? r.reason),
    );

    const agg = await testPrisma.payment.aggregate({
      where: { orderId: order.id },
      _sum: { amountCents: true },
    });

    // Invariant: total paid never exceeds order total. This is the critical
    // property — any surplus would mean a race condition let bad state through.
    expect(agg._sum.amountCents ?? 0).toBeLessThanOrEqual(100_000);
    // With retry-on-busy, the successful ones fully saturate the order.
    expect(agg._sum.amountCents ?? 0).toBe(100_000);
    expect(succeeded).toBe(5);
    expect(failed.length).toBe(5);
    for (const m of failureMessages) {
      expect(m).toMatch(/OVERPAYMENT|would exceed/i);
    }
  });
});

describe("payment service — tenant isolation", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("user B cannot record a payment against user A's order", async () => {
    const userA = await createUser("a@test.com");
    const userB = await createUser("b@test.com");
    const order = await createOrder(userA.id, {
      customer: "Only Mine",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "x", quantity: 1, unitPriceCents: 1000 }],
    });

    await expect(
      recordPayment(userB.id, order.id, {
        amountCents: 100,
        paidAt: new Date(),
        note: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});
