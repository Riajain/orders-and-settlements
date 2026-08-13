import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "OVERPAYMENT"
  | "LOCKED_AFTER_PAYMENT"
  | "CONFLICT"
  | "INTERNAL";

export type ApiErrorBody = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly httpStatus: number,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must be signed in.") {
    super("UNAUTHORIZED", 401, message);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super("NOT_FOUND", 404, `${entity} not found.`);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("VALIDATION_ERROR", 400, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super("CONFLICT", 409, message, details);
  }
}

export class OverpaymentError extends AppError {
  constructor(details: {
    maxAllowedCents: number;
    orderTotalCents: number;
    alreadyPaidCents: number;
    attemptedCents: number;
  }) {
    const dollars = (c: number) => (c / 100).toFixed(2);
    super(
      "OVERPAYMENT",
      409,
      `Payment of $${dollars(details.attemptedCents)} would exceed order total. Maximum allowed: $${dollars(details.maxAllowedCents)}.`,
      details,
    );
  }
}

export class LockedFieldError extends AppError {
  constructor(lockedFields: string[]) {
    super(
      "LOCKED_AFTER_PAYMENT",
      409,
      `These fields cannot be modified after a payment has been recorded: ${lockedFields.join(", ")}. Editable fields: customer, notes, line item descriptions.`,
      { lockedFields },
    );
  }
}

export function toApiErrorResponse(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.httpStatus },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed.",
          details: { issues: error.issues },
        },
      },
      { status: 400 },
    );
  }
  console.error("Unhandled API error:", error);
  return NextResponse.json(
    {
      error: {
        code: "INTERNAL",
        message: "An unexpected error occurred.",
      },
    },
    { status: 500 },
  );
}
