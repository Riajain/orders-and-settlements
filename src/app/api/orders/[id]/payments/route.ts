import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { toApiErrorResponse } from "@/lib/api/errors";
import { listPayments, recordPayment } from "@/lib/services/payments";
import { createPaymentSchema } from "@/lib/validators/payment";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const payments = await listPayments(userId, id);
    return NextResponse.json({ payments });
  } catch (e) {
    return toApiErrorResponse(e);
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    const body = await req.json();
    const input = createPaymentSchema.parse(body);
    const result = await recordPayment(userId, id, input);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return toApiErrorResponse(e);
  }
}
