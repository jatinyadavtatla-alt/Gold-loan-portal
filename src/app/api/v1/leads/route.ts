import {
  ApiError,
  ErrorCodes,
  internalError,
  jsonError,
  jsonFromApiError,
  jsonFromZodError,
  parseJsonBody,
} from "@/lib/api-errors";
import { formatPaiseAsINR, maskMobile } from "@/lib/format";
import { leadInputSchema } from "@/lib/validation";
import { createLead, listLeads } from "@/server/leads";
import { ZodError } from "zod";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/leads — submit a gold-loan application.
 * The quote is recalculated on the server; duplicates within 7 days → 409.
 */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    if (body === null) {
      return jsonError(400, ErrorCodes.INVALID_JSON, "Request body must be valid JSON.");
    }

    const parsed = leadInputSchema.safeParse(body);
    if (!parsed.success) {
      return jsonFromZodError(parsed.error);
    }

    const idempotencyKey =
      request.headers.get("idempotency-key") ||
      request.headers.get("x-idempotency-key") ||
      (typeof body === "object" && body !== null && "idempotencyKey" in body
        ? String((body as Record<string, unknown>).idempotencyKey)
        : undefined);

    const { lead, quote } = await createLead(parsed.data, idempotencyKey);
    const planQuote = quote.plans[0];

    return Response.json(
      {
        applicationId: lead.applicationId,
        status: lead.status,
        applicantName: lead.applicantName,
        maskedMobile: maskMobile(lead.mobile),
        karat: lead.karat,
        grossWeightGrams: lead.grossWeightMg / 1000,
        netWeightGrams: lead.netWeightMg / 1000,
        planId: lead.planId,
        pureGoldGrams: quote.pureGoldGrams,
        goldValuePaise: quote.goldValuePaise,
        goldValueFormatted: formatPaiseAsINR(quote.goldValuePaise),
        eligibleLoanPaise: planQuote.eligibleLoanPaise,
        eligibleLoanFormatted: formatPaiseAsINR(planQuote.eligibleLoanPaise),
        createdAt: lead.createdAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ApiError) return jsonFromApiError(error);
    if (error instanceof ZodError) return jsonFromZodError(error);
    return internalError("leads:create", error);
  }
}

/** GET /api/v1/leads?plan=PLAN_EMI_01&search=Rohit — newest first, mobiles masked. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const plan = url.searchParams.get("plan") ?? undefined;
    const search = url.searchParams.get("search") ?? undefined;
    const leads = await listLeads(plan, search);
    return Response.json({ count: leads.length, leads });
  } catch (error) {
    if (error instanceof ApiError) return jsonFromApiError(error);
    return internalError("leads:list", error);
  }
}

