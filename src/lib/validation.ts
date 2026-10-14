/**
 * Shared Zod validation schemas.
 *
 * The API routes validate request bodies with these schemas, and the AI
 * agent validates its tool arguments with the very same schemas — so a
 * payload that would fail the form fails the agent too.
 */
import { z } from "zod";

export const KARAT_VALUES = [18, 22, 24] as const;
export const MAX_WEIGHT_GRAMS = 1000;

const gramsField = (label: string) =>
  z
    .number()
    .positive(`${label} must be greater than 0`)
    .max(MAX_WEIGHT_GRAMS, `${label} cannot exceed ${MAX_WEIGHT_GRAMS} g`);

export const karatSchema = z.union(
  [z.literal(18), z.literal(22), z.literal(24)],
  { message: "Karat must be 18, 22 or 24" },
);

const quoteBaseShape = {
  grossWeightGrams: gramsField("Gross weight"),
  netWeightGrams: gramsField("Net weight"),
  karat: karatSchema,
};

const netNotAboveGross = (
  value: { netWeightGrams: number; grossWeightGrams: number },
  ctx: z.RefinementCtx,
) => {
  if (value.netWeightGrams > value.grossWeightGrams) {
    ctx.addIssue({
      code: "custom",
      path: ["netWeightGrams"],
      message: "Net weight cannot be greater than gross weight",
    });
  }
};

export const quoteInputSchema = z
  .object({
    ...quoteBaseShape,
    schemeId: z.string().optional(),
    planId: z.string().optional(),
  })
  .superRefine(netNotAboveGross);

export const applicantNameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(60, "Name must be at most 60 characters")
  .regex(/^[A-Za-z]+( [A-Za-z]+)*$/, "Name can contain only letters and single spaces");

export const mobileSchema = z
  .string()
  .trim()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

export const leadInputSchema = z
  .object({
    applicantName: applicantNameSchema,
    mobile: mobileSchema,
    planId: z.string().min(1, "Please select a loan plan"),
    ...quoteBaseShape,
  })
  .superRefine(netNotAboveGross);

/** Tool-argument schemas reuse the exact same rules as the API. */
export const calculateQuoteToolSchema = quoteInputSchema;
export const submitApplicationToolSchema = leadInputSchema;

export const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1, "At least one message is required")
    .max(60, "Conversation is too long"),
});

export type QuoteInputParsed = z.infer<typeof quoteInputSchema>;
export type LeadInputParsed = z.infer<typeof leadInputSchema>;
export type ChatRequestParsed = z.infer<typeof chatRequestSchema>;
