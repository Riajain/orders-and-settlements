import { describe, expect, it } from "vitest";
import { assertEditAllowed } from "@/lib/domain/editability";
import { LockedFieldError } from "@/lib/api/errors";

describe("assertEditAllowed", () => {
  it("allows any edit when no payments exist", () => {
    expect(() =>
      assertEditAllowed(
        {
          customer: "New Co",
          dueDate: new Date(),
          lineItems: [{ quantity: 5, unitPriceCents: 10_000 }],
          replaceLineItems: true,
        },
        false,
      ),
    ).not.toThrow();
  });

  it("allows text-only edits when payments exist", () => {
    expect(() =>
      assertEditAllowed(
        {
          customer: "Renamed",
          notes: "updated",
          lineItems: [{ id: "1", description: "renamed item" }],
        },
        true,
      ),
    ).not.toThrow();
  });

  it("locks dueDate when payments exist", () => {
    expect(() => assertEditAllowed({ dueDate: new Date() }, true)).toThrow(LockedFieldError);
  });

  it("locks quantity when payments exist", () => {
    try {
      assertEditAllowed({ lineItems: [{ id: "1", quantity: 3 }] }, true);
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(LockedFieldError);
      expect((e as LockedFieldError).details).toMatchObject({
        lockedFields: ["lineItems[0].quantity"],
      });
    }
  });

  it("locks unitPriceCents when payments exist", () => {
    expect(() =>
      assertEditAllowed({ lineItems: [{ id: "1", unitPriceCents: 10_000 }] }, true),
    ).toThrow(LockedFieldError);
  });

  it("locks add/remove line items when payments exist", () => {
    expect(() => assertEditAllowed({ replaceLineItems: true }, true)).toThrow(LockedFieldError);
  });
});
