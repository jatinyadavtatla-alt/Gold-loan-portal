/**
 * Consistent JSON error responses for every API route.
 * Shape:  { "error": { "code": string, "message": string, "details"?: unknown } }
 * Stack traces, credentials and raw database errors never leave the server.
 */
import { ZodError } from "zod";

export const ErrorCodes = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_JSON: "INVALID_JSON",
  PLAN_NOT_FOUND: "PLAN_NOT_FOUND",
  DUPLICATE_APPLICATION: "DUPLICATE_APPLICATION",
  DATABASE_UNAVAILABLE: "DATABASE_UNAVAILABLE",
  LLM_NOT_CONFIGURED: "LLM_NOT_CONFIGURED",
  LLM_UNAVAILABLE: "LLM_UNAVAILABLE",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonError(status: number, code: ErrorCode, message: string, details?: unknown) {
  return Response.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status },
  );
}

export function jsonFromApiError(error: ApiError) {
  return jsonError(error.status, error.code, error.message, error.details);
}

/** Map a ZodError to a 400 with per-field details. */
export function jsonFromZodError(error: ZodError) {
  const details = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  const first = details[0]?.message ?? "Invalid request data";
  return jsonError(400, ErrorCodes.VALIDATION_ERROR, first, details);
}

/** Parse a JSON body; returns null when the body is not valid JSON. */
export async function parseJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/**
 * Last-resort error handler. Logs a sanitised message (never request bodies,
 * which may contain personal data like mobile numbers) and returns a
 * generic 500.
 */
export function internalError(scope: string, error: unknown) {
  const safeMessage = error instanceof Error ? error.message : "unknown error";
  console.error(`[api:${scope}] ${safeMessage}`);
  return jsonError(
    500,
    ErrorCodes.INTERNAL_ERROR,
    "Something went wrong on our side. Please try again.",
  );
}
