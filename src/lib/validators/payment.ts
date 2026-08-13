import { z } from "zod";

export const createPaymentSchema = z.object({
  amountCents: z.number().int().min(1, "Amount must be at least 1 cent (0.01)."),
  paidAt: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
  note: z.string().trim().max(500).optional().nullable(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
