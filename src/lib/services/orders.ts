import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/lib/api/errors";
import { computeSubtotalCents } from "@/lib/domain/order-total";
import { deriveStatus, type OrderStatus } from "@/lib/domain/status";
import { assertEditAllowed } from "@/lib/domain/editability";
import type { CreateOrderInput, UpdateOrderInput } from "@/lib/validators/order";

export type OrderWithChildren = Prisma.OrderGetPayload<{
  include: { lineItems: true; payments: true };
}>;

export type OrderSummary = {
  id: string;
  customer: string;
  dueDate: Date;
  totalCents: number;
  paidCents: number;
  dueCents: number;
  status: OrderStatus;
  createdAt: Date;
};

export type OrderDetail = OrderSummary & {
  notes: string | null;
  lineItems: {
    id: string;
    description: string;
    quantity: number;
    unitPriceCents: number;
    position: number;
  }[];
  payments: {
    id: string;
    amountCents: number;
    paidAt: Date;
    note: string | null;
    createdAt: Date;
  }[];
};

function summarize(order: OrderWithChildren, now = new Date()): OrderSummary {
  const paidCents = order.payments.reduce((sum, p) => sum + p.amountCents, 0);
  return {
    id: order.id,
    customer: order.customer,
    dueDate: order.dueDate,
    totalCents: order.totalCents,
    paidCents,
    dueCents: Math.max(order.totalCents - paidCents, 0),
    status: deriveStatus({
      totalCents: order.totalCents,
      paidCents,
      dueDate: order.dueDate,
      now,
    }),
    createdAt: order.createdAt,
  };
}

function toDetail(order: OrderWithChildren): OrderDetail {
  const summary = summarize(order);
  return {
    ...summary,
    notes: order.notes,
    lineItems: order.lineItems
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((li) => ({
        id: li.id,
        description: li.description,
        quantity: li.quantity,
        unitPriceCents: li.unitPriceCents,
        position: li.position,
      })),
    payments: order.payments
      .slice()
      .sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime())
      .map((p) => ({
        id: p.id,
        amountCents: p.amountCents,
        paidAt: p.paidAt,
        note: p.note,
        createdAt: p.createdAt,
      })),
  };
}

export async function listOrders(
  userId: string,
  filterStatus?: OrderStatus,
): Promise<OrderSummary[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: { lineItems: true, payments: true },
    orderBy: { dueDate: "asc" },
  });
  const now = new Date();
  const summaries = orders.map((o) => summarize(o, now));
  if (filterStatus) return summaries.filter((s) => s.status === filterStatus);
  return summaries;
}

export async function getOrder(userId: string, id: string): Promise<OrderDetail> {
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { lineItems: true, payments: true },
  });
  if (!order) throw new NotFoundError("Order");
  return toDetail(order);
}

export async function createOrder(
  userId: string,
  input: CreateOrderInput,
): Promise<OrderDetail> {
  const totalCents = computeSubtotalCents(input.lineItems);

  const created = await prisma.order.create({
    data: {
      userId,
      customer: input.customer,
      dueDate: input.dueDate,
      notes: input.notes ?? null,
      totalCents,
      lineItems: {
        create: input.lineItems.map((li, i) => ({
          description: li.description,
          quantity: li.quantity,
          unitPriceCents: li.unitPriceCents,
          position: i,
        })),
      },
    },
    include: { lineItems: true, payments: true },
  });

  return toDetail(created);
}

export async function updateOrder(
  userId: string,
  id: string,
  input: UpdateOrderInput,
): Promise<OrderDetail> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.order.findFirst({
      where: { id, userId },
      include: { lineItems: true, payments: true },
    });
    if (!existing) throw new NotFoundError("Order");

    const hasPayments = existing.payments.length > 0;

    assertEditAllowed(
      {
        customer: input.customer,
        notes: input.notes ?? undefined,
        dueDate: input.dueDate,
        lineItems: input.lineItems,
        replaceLineItems: input.replaceLineItems,
      },
      hasPayments,
    );

    if (input.customer !== undefined || input.notes !== undefined || input.dueDate !== undefined) {
      await tx.order.update({
        where: { id },
        data: {
          ...(input.customer !== undefined ? { customer: input.customer } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.dueDate !== undefined ? { dueDate: input.dueDate } : {}),
        },
      });
    }

    if (input.replaceLineItems && input.lineItems) {
      await tx.lineItem.deleteMany({ where: { orderId: id } });
      for (let i = 0; i < input.lineItems.length; i++) {
        const li = input.lineItems[i];
        if (li.description === undefined || li.quantity === undefined || li.unitPriceCents === undefined) {
          throw new ConflictError(
            "When replacing line items, each item requires description, quantity, and unitPriceCents.",
          );
        }
        await tx.lineItem.create({
          data: {
            orderId: id,
            description: li.description,
            quantity: li.quantity,
            unitPriceCents: li.unitPriceCents,
            position: i,
          },
        });
      }
    } else if (input.lineItems) {
      for (const li of input.lineItems) {
        if (!li.id) continue;
        const owned = existing.lineItems.find((x) => x.id === li.id);
        if (!owned) throw new NotFoundError(`Line item ${li.id}`);
        await tx.lineItem.update({
          where: { id: li.id },
          data: {
            ...(li.description !== undefined ? { description: li.description } : {}),
            ...(li.quantity !== undefined ? { quantity: li.quantity } : {}),
            ...(li.unitPriceCents !== undefined ? { unitPriceCents: li.unitPriceCents } : {}),
          },
        });
      }
    }

    const refreshed = await tx.order.findUniqueOrThrow({
      where: { id },
      include: { lineItems: true, payments: true },
    });
    const newTotal = computeSubtotalCents(refreshed.lineItems);
    if (newTotal !== refreshed.totalCents) {
      await tx.order.update({ where: { id }, data: { totalCents: newTotal } });
      refreshed.totalCents = newTotal;
    }

    return toDetail(refreshed);
  });
}

export async function deleteOrder(userId: string, id: string): Promise<void> {
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { payments: { select: { id: true } } },
  });
  if (!order) throw new NotFoundError("Order");
  if (order.payments.length > 0) {
    throw new ConflictError(
      "Cannot delete an order with recorded payments. Delete the payments first or archive the order.",
    );
  }
  await prisma.order.delete({ where: { id } });
}
