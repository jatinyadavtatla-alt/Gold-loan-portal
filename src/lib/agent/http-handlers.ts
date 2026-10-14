/**
 * Default tool handlers: each tool calls the real REST API of this
 * application (same origin), so the agent goes through exactly the same
 * validation and financial services as the web form. Nothing is simulated.
 */
import { formatPaiseAsINR } from "@/lib/format";
import type { ToolHandler, ToolHandlers } from "./types";

export function createHttpToolHandlers(origin: string): ToolHandlers {
  const getSchemes: ToolHandler = async () => {
    const res = await fetch(`${origin}/api/v1/loan-schemes`, { cache: "no-store" });
    const body = await res.json();
    const count = Array.isArray(body.schemes) ? body.schemes.length : 0;
    return {
      content: JSON.stringify(body),
      isError: !res.ok,
      detail: res.ok ? `${count} active plans` : "Could not load plans",
    };
  };

  const calculateQuote: ToolHandler = async (input) => {
    const res = await fetch(`${origin}/api/v1/quotes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await res.json();

    if (!res.ok) {
      return { content: JSON.stringify(body), isError: true, detail: "Quote rejected — correction requested" };
    }
    const best = body.plans?.reduce(
      (max: number, p: { eligibleLoanPaise: number }) => Math.max(max, p.eligibleLoanPaise),
      0,
    );
    return {
      content: JSON.stringify(body),
      detail: `Gold value ${body.goldValueFormatted} · eligible up to ${formatPaiseAsINR(best ?? 0)}`,
    };
  };

  const submitApplication: ToolHandler = async (input) => {
    const res = await fetch(`${origin}/api/v1/leads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await res.json();

    if (res.status === 201) {
      return {
        content: JSON.stringify(body),
        detail: `Application ${body.applicationId}`,
      };
    }
    if (res.status === 409) {
      return {
        content: JSON.stringify(body),
        isError: true,
        detail: `Duplicate — existing ${body?.error?.details?.existingApplicationId ?? "application"}`,
      };
    }
    return { content: JSON.stringify(body), isError: true, detail: "Submission rejected — correction requested" };
  };

  return {
    get_loan_schemes: getSchemes,
    calculate_quote: calculateQuote,
    submit_application: submitApplication,
  };
}
