import { LockedFieldError } from "@/lib/api/errors";

export type LineItemPatch = {
  id?: string;
  description?: string;
  quantity?: number;
  unitPriceCents?: number;
};

export type OrderPatch = {
  customer?: string;
  notes?: string | null;
  dueDate?: Date | string;
  lineItems?: LineItemPatch[];
  replaceLineItems?: boolean; // true if lineItems is the full new set (add/remove)
};

/**
 * Hybrid policy: after any payment exists, text fields stay editable,
 * money fields (dueDate, quantity, unitPriceCents) and add/remove of line items
 * are locked.
 */
export function assertEditAllowed(patch: OrderPatch, hasPayments: boolean): void {
  if (!hasPayments) return;

  const locked: string[] = [];

  if (patch.dueDate !== undefined) locked.push("dueDate");

  if (patch.replaceLineItems) locked.push("lineItems (add/remove)");

  if (patch.lineItems) {
    patch.lineItems.forEach((li, i) => {
      if (li.quantity !== undefined) locked.push(`lineItems[${i}].quantity`);
      if (li.unitPriceCents !== undefined) locked.push(`lineItems[${i}].unitPriceCents`);
    });
  }

  if (locked.length > 0) {
    throw new LockedFieldError(locked);
  }
}
