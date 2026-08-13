import { describe, expect, it } from "vitest";
import { assertPaymentAllowed } from "@/lib/domain/payment-validation";
import { OverpaymentError } from "@/lib/api/errors";

describe("assertPaymentAllowed", () => {
  it("allows a payment less than remaining", () => {
    expect(() =>
      assertPaymentAllowed({
        amountCents: 40_000,
        orderTotalCents: 100_000,
        alreadyPaidCents: 0,
      }),
    ).not.toThrow();
  });

  it("allows a payment equal to remaining", () => {
    expect(() =>
      assertPaymentAllowed({
        amountCents: 60_000,
        orderTotalCents: 100_000,
        alreadyPaidCents: 40_000,
      }),
    ).not.toThrow();
  });

  it("rejects a payment that exceeds remaining with OverpaymentError", () => {
    try {
      assertPaymentAllowed({
        amountCents: 100,
        orderTotalCents: 100_000,
        alreadyPaidCents: 100_000,
      });
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(OverpaymentError);
      const err = e as OverpaymentError;
      expect(err.details).toMatchObject({
        maxAllowedCents: 0,
        orderTotalCents: 100_000,
        alreadyPaidCents: 100_000,
        attemptedCents: 100,
      });
      expect(err.message).toContain("Maximum allowed: $0.00");
    }
  });

  it("throws on zero or negative amount", () => {
    expect(() =>
      assertPaymentAllowed({
        amountCents: 0,
        orderTotalCents: 100_000,
        alreadyPaidCents: 0,
      }),
    ).toThrow();
  });
});
