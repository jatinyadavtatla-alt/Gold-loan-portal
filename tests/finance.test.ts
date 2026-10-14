import { describe, expect, it } from "vitest";
import {
  computeQuote,
  floorPaiseToRupees,
  gramsToMilligrams,
  RBI_MAX_LTV_BPS,
  type PlanFinancials,
} from "@/lib/finance";

const EMI: PlanFinancials = {
  id: "PLAN_EMI_01",
  name: "Monthly EMI",
  annualInterestRateBps: 1050,
  tenureMonths: 12,
  maxLtvBps: 7500,
};
const BULLET: PlanFinancials = {
  id: "PLAN_BULLET_01",
  name: "Bullet Repayment",
  annualInterestRateBps: 1200,
  tenureMonths: 12,
  maxLtvBps: 7000,
};

describe("gold loan financial service (assignment examples)", () => {
  it("45 g net, 22K, EMI plan → 41.25 g, ₹2,88,750 value, ₹2,16,562 loan", () => {
    const quote = computeQuote({ netWeightGrams: 45, karat: 22 }, [EMI]);

    expect(quote.pureGoldGrams).toBe(41.25);
    expect(quote.goldValueRupees).toBe(288_750);
    expect(quote.goldValuePaise).toBe(28_875_000);

    const plan = quote.plans[0];
    expect(plan.appliedLtvPercent).toBe(75);
    expect(plan.eligibleLoanRupees).toBe(216_562); // floor(288750 × 0.75) = 216562.50 → 216562
    expect(plan.eligibleLoanPaise).toBe(21_656_250);
  });

  it("45 g net, 22K, Bullet plan → ₹2,02,125 loan", () => {
    const quote = computeQuote({ netWeightGrams: 45, karat: 22 }, [BULLET]);
    expect(quote.goldValueRupees).toBe(288_750);
    const plan = quote.plans[0];
    expect(plan.appliedLtvPercent).toBe(70);
    expect(plan.eligibleLoanRupees).toBe(202_125);
    expect(plan.eligibleLoanPaise).toBe(20_212_500);
  });

  it("10 g net, 18K, EMI plan → 7.5 g, ₹52,500 value, ₹39,375 loan", () => {
    const quote = computeQuote({ netWeightGrams: 10, karat: 18 }, [EMI]);
    expect(quote.pureGoldGrams).toBe(7.5);
    expect(quote.goldValueRupees).toBe(52_500);
    expect(quote.plans[0].eligibleLoanRupees).toBe(39_375);
    expect(quote.plans[0].eligibleLoanPaise).toBe(3_937_500);
  });

  it("caps LTV at the 75% regulatory maximum even if a plan allows more", () => {
    const aggressive: PlanFinancials = { ...EMI, id: "PLAN_X", maxLtvBps: 9000 };
    const quote = computeQuote({ netWeightGrams: 100, karat: 24 }, [aggressive]);
    expect(quote.plans[0].appliedLtvPercent).toBe(RBI_MAX_LTV_BPS / 100);
    // 100 g × ₹7000 = ₹7,00,000 → 75% = ₹5,25,000
    expect(quote.plans[0].eligibleLoanRupees).toBe(525_000);
  });

  it("stores money as exact integer paise (no floating-point drift)", () => {
    const quote = computeQuote({ netWeightGrams: 33.333, karat: 22 }, [EMI]);
    expect(Number.isInteger(quote.goldValuePaise)).toBe(true);
    expect(Number.isInteger(quote.plans[0].eligibleLoanPaise)).toBe(true);
  });

  it("floors eligible loan to whole paise per the assignment formula", () => {
    // goldValue 33333 paise × 33.33% → 11099.888… paise → floor = 11099
    const odd: PlanFinancials = { ...EMI, id: "ODD", maxLtvBps: 3333 };
    const quote = computeQuote({ netWeightGrams: 0.152, karat: 18 }, [odd]);
    // pure = 152 × 18/24 = 114 mg → 114 × 0.7 paise... verified below by construction:
    expect(quote.plans[0].eligibleLoanPaise).toBe(
      Math.floor((quote.goldValuePaise * 3333) / 10_000),
    );
  });

  it("converts grams to integer milligrams and floors paise to rupees", () => {
    expect(gramsToMilligrams(41.25)).toBe(41_250);
    expect(floorPaiseToRupees(21_656_250)).toBe(216_562);
  });
});
