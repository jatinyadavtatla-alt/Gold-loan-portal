import {
  ApiError,
  ErrorCodes,
  internalError,
  jsonError,
  jsonFromApiError,
  jsonFromZodError,
  parseJsonBody,
} from "@/lib/api-errors";
import { computeQuote } from "@/lib/finance";
import { formatPaiseAsINR } from "@/lib/format";
import { quoteInputSchema } from "@/lib/validation";
import { getActiveSchemes, toPlanFinancials } from "@/server/plans";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/quotes — validate inputs and return pure gold weight, gold
 * value and eligible loan for every active plan. Writes nothing to the DB.
 */
export async function POST(request: Request) {
  try {
    const body = await parseJsonBody(request);
    if (body === null) {
      return jsonError(400, ErrorCodes.INVALID_JSON, "Request body must be valid JSON.");
    }

    const parsed = quoteInputSchema.safeParse(body);
    if (!parsed.success) {
      return jsonFromZodError(parsed.error);
    }

    const schemes = await getActiveSchemes();
    const requestedSchemeId = parsed.data.schemeId || parsed.data.planId;

    if (requestedSchemeId) {
      const schemeExists = schemes.some((s) => s.id === requestedSchemeId);
      if (!schemeExists) {
        return jsonError(
          404,
          ErrorCodes.PLAN_NOT_FOUND,
          `The selected loan scheme "${requestedSchemeId}" does not exist or is no longer active.`,
        );
      }
    }

    const quote = computeQuote(parsed.data, schemes.map(toPlanFinancials));
    const plans = quote.plans.map((plan) => ({
      ...plan,
      eligibleLoanFormatted: formatPaiseAsINR(plan.eligibleLoanPaise),
    }));

    const selectedPlan = requestedSchemeId
      ? plans.find((p) => p.planId === requestedSchemeId)
      : undefined;

    return Response.json({
      rate24kPerGramRupees: quote.rate24kPerGramRupees,
      grossWeightGrams: parsed.data.grossWeightGrams,
      netWeightGrams: quote.netWeightGrams,
      karat: quote.karat,
      pureGoldGrams: quote.pureGoldGrams,
      goldValuePaise: quote.goldValuePaise,
      goldValueRupees: quote.goldValueRupees,
      goldValueFormatted: formatPaiseAsINR(quote.goldValuePaise),
      ...(selectedPlan ? { selectedPlan } : {}),
      plans,
    });
  } catch (error) {
    if (error instanceof ApiError) return jsonFromApiError(error);
    return internalError("quotes", error);
  }
}

