export type LineItemInput = { quantity: number; unitPriceCents: number };

export function computeSubtotalCents(items: LineItemInput[]): number {
  return items.reduce((acc, li) => acc + li.quantity * li.unitPriceCents, 0);
}
