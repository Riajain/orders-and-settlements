import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/api/errors";
import { deleteOrder, getOrder, updateOrder } from "@/lib/services/orders";
import { updateOrderSchema } from "@/lib/validators/order";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const order = await getOrder(userId, id);
    return NextResponse.json({ order });
  } catch (e) {
    return toApiErrorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await req.json();
    const input = updateOrderSchema.parse(body);
    const order = await updateOrder(userId, id, input);
    return NextResponse.json({ order });
  } catch (e) {
    return toApiErrorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await deleteOrder(userId, id);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toApiErrorResponse(e);
  }
}
