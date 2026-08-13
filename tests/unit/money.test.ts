import { describe, expect, it } from "vitest";
import { formatCents, formatUSD, toCents } from "@/lib/domain/money";

describe("toCents", () => {
  it("converts whole dollars", () => {
    expect(toCents(10)).toBe(1000);
  });

  it("converts decimal strings", () => {
    expect(toCents("19.99")).toBe(1999);
  });

  it("avoids float drift on 0.1 + 0.2", () => {
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it("rounds half-away-from-zero", () => {
    expect(toCents(0.005)).toBe(1);
    expect(toCents(0.014)).toBe(1);
    expect(toCents(0.016)).toBe(2);
  });

  it("throws on NaN or infinity", () => {
    expect(() => toCents("not a number")).toThrow();
    expect(() => toCents(Number.POSITIVE_INFINITY)).toThrow();
  });
});

describe("formatCents", () => {
  it("formats zero", () => {
    expect(formatCents(0)).toBe("0.00");
  });

  it("formats dollars and cents", () => {
    expect(formatCents(199)).toBe("1.99");
    expect(formatCents(100000)).toBe("1000.00");
  });

  it("handles negative amounts", () => {
    expect(formatCents(-250)).toBe("-2.50");
  });
});

describe("formatUSD", () => {
  it("adds dollar sign and thousands separators", () => {
    expect(formatUSD(0)).toBe("$0.00");
    expect(formatUSD(100000)).toBe("$1,000.00");
    expect(formatUSD(1234567)).toBe("$12,345.67");
  });
});
