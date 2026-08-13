import { z } from "zod";

const lineItemInputSchema = z.object({
  description: z.string().trim().min(1, "Description is required.").max(200),
  quantity: z.number().int().min(1, "Quantity must be at least 1."),
  unitPriceCents: z.number().int().min(0, "Unit price cannot be negative."),
});

export const createOrderSchema = z.object({
  customer: z.string().trim().min(1, "Customer is required.").max(200),
  dueDate: z.union([z.string(), z.date()]).transform((v) => new Date(v)),
  notes: z.string().trim().max(2000).optional().nullable(),
  lineItems: z.array(lineItemInputSchema).min(1, "At least one line item is required."),
});

const lineItemPatchSchema = z.object({
  id: z.string().optional(),
  description: z.string().trim().min(1).max(200).optional(),
  quantity: z.number().int().min(1).optional(),
  unitPriceCents: z.number().int().min(0).optional(),
});

export const updateOrderSchema = z.object({
  customer: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  dueDate: z.union([z.string(), z.date()]).transform((v) => new Date(v)).optional(),
  lineItems: z.array(lineItemPatchSchema).optional(),
  replaceLineItems: z.boolean().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
