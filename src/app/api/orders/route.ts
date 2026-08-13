import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/api/errors";
import { createOrder, listOrders } from "@/lib/services/orders";
import { createOrderSchema } from "@/lib/validators/order";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/domain/status";

export async function GET(req: Request) {
  try {
    const userId = await requireUserId();
    const url = new URL(req.url);
    const statusParam = url.searchParams.get("status");
    const status =
      statusParam && (ORDER_STATUSES as string[]).includes(statusParam)
        ? (statusParam as OrderStatus)
        : undefined;

    const orders = await listOrders(userId, status);
    return NextResponse.json({ orders });
  } catch (e) {
    return toApiErrorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const userId = await requireUserId();
    const body = await req.json();
    const input = createOrderSchema.parse(body);
    const order = await createOrder(userId, input);
    return NextResponse.json({ order }, { status: 201 });
  } catch (e) {
    return toApiErrorResponse(e);
  }
}
