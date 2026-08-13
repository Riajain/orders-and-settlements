import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DAY = 24 * 60 * 60 * 1000;

async function main() {
  const email = "demo@example.com";
  const passwordHash = await bcrypt.hash("demo1234", 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Demo user already exists (${email}); skipping seed.`);
    return;
  }

  const user = await prisma.user.create({
    data: { email, passwordHash },
  });

  const now = Date.now();

  // 1) Pending: no payments, due in 7 days
  await prisma.order.create({
    data: {
      userId: user.id,
      customer: "Acme Corp",
      dueDate: new Date(now + 7 * DAY),
      totalCents: 100_000,
      lineItems: {
        create: [
          { description: "Consulting hours", quantity: 2, unitPriceCents: 50_000, position: 0 },
        ],
      },
    },
  });

  // 2) Partially paid: due in 14 days
  await prisma.order.create({
    data: {
      userId: user.id,
      customer: "Globex Inc",
      dueDate: new Date(now + 14 * DAY),
      totalCents: 250_000,
      lineItems: {
        create: [
          { description: "Widget", quantity: 10, unitPriceCents: 20_000, position: 0 },
          { description: "Setup fee", quantity: 1, unitPriceCents: 50_000, position: 1 },
        ],
      },
      payments: {
        create: [{ amountCents: 100_000, paidAt: new Date(now - 2 * DAY), note: "Deposit" }],
      },
    },
  });

  // 3) Overdue: past due, no payments
  await prisma.order.create({
    data: {
      userId: user.id,
      customer: "Initech",
      dueDate: new Date(now - 5 * DAY),
      totalCents: 75_000,
      lineItems: {
        create: [
          { description: "Report bundle", quantity: 3, unitPriceCents: 25_000, position: 0 },
        ],
      },
    },
  });

  // 4) Paid: fully settled
  await prisma.order.create({
    data: {
      userId: user.id,
      customer: "Stark Industries",
      dueDate: new Date(now + 3 * DAY),
      totalCents: 40_000,
      lineItems: {
        create: [
          { description: "Arc reactor tune-up", quantity: 1, unitPriceCents: 40_000, position: 0 },
        ],
      },
      payments: {
        create: [{ amountCents: 40_000, paidAt: new Date(now - 1 * DAY), note: "Wire transfer" }],
      },
    },
  });

  console.log(`Seeded demo user ${email} with 4 sample orders.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
