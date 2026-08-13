import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/api/errors";
import { deletePayment } from "@/lib/services/payments";

type Ctx = { params: Promise<{ id: string; paymentId: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id, paymentId } = await params;
    await deletePayment(userId, id, paymentId);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return toApiErrorResponse(e);
  }
}
