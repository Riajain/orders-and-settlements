import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { testPrisma, resetDatabase } from "../setup";

vi.mock("@/lib/prisma", () => ({ prisma: testPrisma }));

const { createOrder, updateOrder, deleteOrder, listOrders } = await import(
  "@/lib/services/orders"
);
const { recordPayment } = await import("@/lib/services/payments");
const { LockedFieldError, ConflictError, NotFoundError } = await import(
  "@/lib/api/errors"
);

async function createUser(email: string) {
  return testPrisma.user.create({
    data: { email, passwordHash: "unused" },
  });
}

const DAY = 24 * 60 * 60 * 1000;
const inDays = (d: number) => new Date(Date.now() + d * DAY);

describe("orders service", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await testPrisma.$disconnect();
  });

  it("createOrder computes totalCents from line items", async () => {
    const user = await createUser("orders@test.com");
    const order = await createOrder(user.id, {
      customer: "Foo",
      dueDate: inDays(7),
      notes: null,
      lineItems: [
        { description: "A", quantity: 3, unitPriceCents: 100 },
        { description: "B", quantity: 2, unitPriceCents: 250 },
      ],
    });
    expect(order.totalCents).toBe(3 * 100 + 2 * 250);
  });

  it("updateOrder — allows text edit after payment", async () => {
    const user = await createUser("edit-text@test.com");
    const order = await createOrder(user.id, {
      customer: "Acme",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "orig", quantity: 1, unitPriceCents: 1000 }],
    });
    await recordPayment(user.id, order.id, {
      amountCents: 500,
      paidAt: new Date(),
      note: null,
    });

    const updated = await updateOrder(user.id, order.id, {
      customer: "Acme Renamed",
      notes: "text notes ok",
      lineItems: [{ id: order.lineItems[0].id, description: "renamed" }],
    });
    expect(updated.customer).toBe("Acme Renamed");
    expect(updated.notes).toBe("text notes ok");
    expect(updated.lineItems[0].description).toBe("renamed");
  });

  it("updateOrder — rejects unitPriceCents change after payment", async () => {
    const user = await createUser("edit-money@test.com");
    const order = await createOrder(user.id, {
      customer: "Acme",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "x", quantity: 1, unitPriceCents: 1000 }],
    });
    await recordPayment(user.id, order.id, {
      amountCents: 100,
      paidAt: new Date(),
      note: null,
    });

    await expect(
      updateOrder(user.id, order.id, {
        lineItems: [{ id: order.lineItems[0].id, unitPriceCents: 500 }],
      }),
    ).rejects.toBeInstanceOf(LockedFieldError);
  });

  it("updateOrder — rejects dueDate change after payment", async () => {
    const user = await createUser("edit-due@test.com");
    const order = await createOrder(user.id, {
      customer: "Acme",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "x", quantity: 1, unitPriceCents: 1000 }],
    });
    await recordPayment(user.id, order.id, {
      amountCents: 100,
      paidAt: new Date(),
      note: null,
    });

    await expect(
      updateOrder(user.id, order.id, { dueDate: inDays(30) }),
    ).rejects.toBeInstanceOf(LockedFieldError);
  });

  it("updateOrder — quantity change on unpaid order works and recomputes total", async () => {
    const user = await createUser("edit-unpaid@test.com");
    const order = await createOrder(user.id, {
      customer: "Acme",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "x", quantity: 1, unitPriceCents: 1000 }],
    });
    const updated = await updateOrder(user.id, order.id, {
      lineItems: [{ id: order.lineItems[0].id, quantity: 5 }],
    });
    expect(updated.totalCents).toBe(5000);
  });

  it("deleteOrder — refuses when payments exist", async () => {
    const user = await createUser("del-paid@test.com");
    const order = await createOrder(user.id, {
      customer: "Acme",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "x", quantity: 1, unitPriceCents: 1000 }],
    });
    await recordPayment(user.id, order.id, {
      amountCents: 100,
      paidAt: new Date(),
      note: null,
    });
    await expect(deleteOrder(user.id, order.id)).rejects.toBeInstanceOf(ConflictError);
  });

  it("listOrders — filter by status returns only matching", async () => {
    const user = await createUser("list@test.com");
    await createOrder(user.id, {
      customer: "Pending Co",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "x", quantity: 1, unitPriceCents: 1000 }],
    });
    const paid = await createOrder(user.id, {
      customer: "Paid Co",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "x", quantity: 1, unitPriceCents: 1000 }],
    });
    await recordPayment(user.id, paid.id, {
      amountCents: 1000,
      paidAt: new Date(),
      note: null,
    });

    const pendingOnly = await listOrders(user.id, "pending");
    expect(pendingOnly).toHaveLength(1);
    expect(pendingOnly[0].customer).toBe("Pending Co");

    const paidOnly = await listOrders(user.id, "paid");
    expect(paidOnly).toHaveLength(1);
    expect(paidOnly[0].customer).toBe("Paid Co");
  });

  it("cross-tenant isolation on getOrder/updateOrder/deleteOrder", async () => {
    const userA = await createUser("iso-a@test.com");
    const userB = await createUser("iso-b@test.com");
    const order = await createOrder(userA.id, {
      customer: "A's order",
      dueDate: inDays(7),
      notes: null,
      lineItems: [{ description: "x", quantity: 1, unitPriceCents: 1000 }],
    });
    await expect(
      updateOrder(userB.id, order.id, { customer: "hack" }),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteOrder(userB.id, order.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});
