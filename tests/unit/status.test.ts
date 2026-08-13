import { describe, expect, it } from "vitest";
import { deriveStatus } from "@/lib/domain/status";

const now = new Date("2026-08-12T12:00:00Z");
const future = new Date("2026-08-20T12:00:00Z");
const past = new Date("2026-08-01T12:00:00Z");

describe("deriveStatus", () => {
  it("pending when no payments and not past due", () => {
    expect(
      deriveStatus({ totalCents: 100_000, paidCents: 0, dueDate: future, now }),
    ).toBe("pending");
  });

  it("partially_paid when 0 < paid < total and not past due", () => {
    expect(
      deriveStatus({ totalCents: 100_000, paidCents: 40_000, dueDate: future, now }),
    ).toBe("partially_paid");
  });

  it("paid when paid equals total", () => {
    expect(
      deriveStatus({ totalCents: 100_000, paidCents: 100_000, dueDate: future, now }),
    ).toBe("paid");
  });

  it("paid wins over overdue when fully paid past due date", () => {
    expect(
      deriveStatus({ totalCents: 100_000, paidCents: 100_000, dueDate: past, now }),
    ).toBe("paid");
  });

  it("overdue when past due date and no payments", () => {
    expect(
      deriveStatus({ totalCents: 100_000, paidCents: 0, dueDate: past, now }),
    ).toBe("overdue");
  });

  it("overdue beats partially_paid when past due date with partial payment", () => {
    expect(
      deriveStatus({ totalCents: 100_000, paidCents: 40_000, dueDate: past, now }),
    ).toBe("overdue");
  });

  it("treats exact due-date time as still on-time (not overdue)", () => {
    expect(
      deriveStatus({ totalCents: 100_000, paidCents: 0, dueDate: now, now }),
    ).toBe("pending");
  });
});
