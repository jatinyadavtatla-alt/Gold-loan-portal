/**
 * The three mandated tools. JSON Schemas are sent to the LLM; the Zod
 * schemas (shared with the REST API) validate the model's arguments before
 * anything executes — so the model can never slip invalid data past the API.
 */
import {
  calculateQuoteToolSchema,
  submitApplicationToolSchema,
} from "@/lib/validation";
import type { z } from "zod";

export interface ToolDefinition {
  name: string;
  /** Short label shown in the chat UI while/after the tool runs. */
  label: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Zod schema used to validate model-supplied arguments server-side. */
  argSchema: z.ZodType | null;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "get_loan_schemes",
    label: "Checked available loan plans",
    description:
      "Fetch the currently active gold loan schemes (name, annual interest rate, tenure and maximum LTV).",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    argSchema: null,
  },
  {
    name: "calculate_quote",
    label: "Calculated gold loan quote",
    description:
      "Calculate pure gold weight, gold value and eligible loan for every plan using the official ₹7,000/g 24K reference rate. You MUST use this tool for any gold value or loan amount — never do the arithmetic yourself.",
    parameters: {
      type: "object",
      properties: {
        grossWeightGrams: { type: "number", description: "Gross ornament weight in grams (0 < gross ≤ 1000)" },
        netWeightGrams: { type: "number", description: "Net gold weight in grams, excluding stones (0 < net ≤ gross)" },
        karat: { type: "integer", description: "Gold purity: 18, 22 or 24 karat" },
      },
      required: ["grossWeightGrams", "netWeightGrams", "karat"],
      additionalProperties: false,
    },
    argSchema: calculateQuoteToolSchema,
  },
  {
    name: "submit_application",
    label: "Submitted gold loan application",
    description:
      "Submit a gold loan application. Call this ONLY after you have shown the customer the complete application summary (name, mobile, weights, karat, plan and eligible loan amount) and they have explicitly confirmed. The server re-validates and re-calculates everything.",
    parameters: {
      type: "object",
      properties: {
        applicantName: { type: "string", description: "Applicant's full name (letters and spaces, 2–60 chars)" },
        mobile: { type: "string", description: "10-digit Indian mobile number starting with 6–9" },
        grossWeightGrams: { type: "number" },
        netWeightGrams: { type: "number" },
        karat: { type: "integer", description: "Gold purity: 18, 22 or 24 karat" },
        planId: { type: "string", enum: ["PLAN_EMI_01", "PLAN_BULLET_01"] },
      },
      required: ["applicantName", "mobile", "grossWeightGrams", "netWeightGrams", "karat", "planId"],
      additionalProperties: false,
    },
    argSchema: submitApplicationToolSchema,
  },
];

export const TOOL_DEFINITIONS_BY_NAME = new Map(TOOL_DEFINITIONS.map((t) => [t.name, t]));

export const GUARD_ERROR_CODE = "CONFIRMATION_REQUIRED";
