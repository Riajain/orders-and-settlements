import { describe, expect, it } from "vitest";
import { computeSubtotalCents } from "@/lib/domain/order-total";

describe("computeSubtotalCents", () => {
  it("returns 0 for empty line items", () => {
    expect(computeSubtotalCents([])).toBe(0);
  });

  it("computes 2 x $500 = $1000 (100_000 cents)", () => {
    expect(
      computeSubtotalCents([{ quantity: 2, unitPriceCents: 50_000 }]),
    ).toBe(100_000);
  });

  it("sums multiple line items", () => {
    expect(
      computeSubtotalCents([
        { quantity: 10, unitPriceCents: 2_000 },
        { quantity: 1, unitPriceCents: 5_000 },
        { quantity: 3, unitPriceCents: 100 },
      ]),
    ).toBe(25_300);
  });
});
