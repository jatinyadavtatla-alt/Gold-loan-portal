import type { ZodError } from "zod";

/** Compact [{ path, message }] payload for tool error feedback. */
export function zodErrorText(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
