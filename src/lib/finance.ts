/**
 * Financial calculation service — the single source of truth for gold-loan maths.
 *
 * Money is handled as INTEGER PAISE (1 rupee = 100 paise) and weights as
 * integer milligrams internally, so no floating-point artefacts ever enter
 * stored or returned money values.
 *
 * Assignment formulas (unchanged):
 *   pureGoldGrams = netWeightGrams × (karat / 24)
 *   goldValue     = pureGoldGrams × rate24kPerGram
 *   eligibleLoan  = floor(goldValue × min(plan.maxLtv, 0.75))
 */

export const DEFAULT_GOLD_RATE_24K_RUPEES_PER_GRAM = 7000;
/** RBI-imposed cap on loan-to-value for gold loans. */
export const RBI_MAX_LTV_BPS = 7500; // 75.00%

export interface PlanFinancials {
  id: string;
  name: string;
  annualInterestRateBps: number;
  tenureMonths: number;
  maxLtvBps: number;
}

export interface QuoteInput {
  netWeightGrams: number;
  karat: number;
}

export interface QuotePlanResult {
  planId: string;
  planName: string;
  annualInterestRatePercent: number;
  tenureMonths: number;
  maxLtvPercent: number;
  /** The LTV actually applied after the 75% regulatory cap. */
  appliedLtvPercent: number;
  eligibleLoanPaise: number;
  /** Whole rupees, floored — matches the assignment's expected display values. */
  eligibleLoanRupees: number;
}

export interface QuoteResult {
  rate24kPerGramRupees: number;
  netWeightGrams: number;
  karat: number;
  pureGoldGrams: number;
  goldValuePaise: number;
  goldValueRupees: number;
  plans: QuotePlanResult[];
}

/** Current mock 24-karat rate (rupees per gram). Overridable via env for demos. */
export function goldRate24kRupeesPerGram(): number {
  const raw = process.env.GOLD_RATE_24K_PER_GRAM;
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : DEFAULT_GOLD_RATE_24K_RUPEES_PER_GRAM;
}

/** Convert a gram amount to integer milligrams (rounds to nearest mg). */
export function gramsToMilligrams(grams: number): number {
  return Math.round(grams * 1000);
}

/** Basis points → display percent number (7500 → 75, 1050 → 10.5). */
export function bpsToPercent(bps: number): number {
  return bps / 100;
}

export function floorPaiseToRupees(paise: number): number {
  return Math.floor(paise / 100);
}

/**
 * Compute a quote for a set of plans. Pure function — no I/O, fully testable.
 * Both the public quotes API and the leads API use this, and the AI agent
 * reaches it only through the API, so arithmetic is never done by an LLM
 * or by the browser.
 */
export function computeQuote(input: QuoteInput, plans: PlanFinancials[]): QuoteResult {
  const rate24k = goldRate24kRupeesPerGram();
  const netMg = gramsToMilligrams(input.netWeightGrams);

  // Pure gold in milligrams (may be fractional before display rounding).
  const pureGoldMgExact = (netMg * input.karat) / 24;

  // rate (₹/g) × 100 = paise/g; ÷ 1000 = paise/mg.
  const paisePerMg = (rate24k * 100) / 1000;
  const goldValuePaise = Math.round(pureGoldMgExact * paisePerMg);

  const planResults = plans.map<QuotePlanResult>((plan) => {
    const appliedLtvBps = Math.min(plan.maxLtvBps, RBI_MAX_LTV_BPS);
    const eligibleLoanPaise = Math.floor((goldValuePaise * appliedLtvBps) / 10_000);
    return {
      planId: plan.id,
      planName: plan.name,
      annualInterestRatePercent: bpsToPercent(plan.annualInterestRateBps),
      tenureMonths: plan.tenureMonths,
      maxLtvPercent: bpsToPercent(plan.maxLtvBps),
      appliedLtvPercent: bpsToPercent(appliedLtvBps),
      eligibleLoanPaise,
      eligibleLoanRupees: floorPaiseToRupees(eligibleLoanPaise),
    };
  });

  return {
    rate24kPerGramRupees: rate24k,
    netWeightGrams: input.netWeightGrams,
    karat: input.karat,
    pureGoldGrams: Number((pureGoldMgExact / 1000).toFixed(3)),
    goldValuePaise,
    goldValueRupees: floorPaiseToRupees(goldValuePaise),
    plans: planResults,
  };
}
