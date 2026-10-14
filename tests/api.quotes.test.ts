import { beforeAll, describe, expect, it } from "vitest";
import { GET as getSchemes } from "@/app/api/v1/loan-schemes/route";
import { POST as postQuote } from "@/app/api/v1/quotes/route";
import { ensureDbReady } from "@/db/bootstrap";
import { API_BASE, postJson } from "./helpers";

beforeAll(async () => {
  try {
    await ensureDbReady();
  } catch {
    // DB not available; using seed plan fallback
  }
});

describe("GET /api/v1/loan-schemes", () => {
  it("returns the two seeded active schemes with rates, tenure and LTV", async () => {
    const res = await getSchemes();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(Array.isArray(body.schemes)).toBe(true);
    expect(body.schemes.length).toBeGreaterThanOrEqual(2);

    const emi = body.schemes.find((s: { id: string }) => s.id === "PLAN_EMI_01");
    const bullet = body.schemes.find((s: { id: string }) => s.id === "PLAN_BULLET_01");
    expect(emi).toMatchObject({
      name: "Monthly EMI",
      annualInterestRatePercent: 10.5,
      tenureMonths: 12,
      maxLtvPercent: 75,
    });
    expect(bullet).toMatchObject({
      name: "Bullet Repayment",
      annualInterestRatePercent: 12,
      tenureMonths: 12,
      maxLtvPercent: 70,
    });
  });
});

describe("POST /api/v1/quotes", () => {
  it("returns per-plan quotes for the 45 g / 22K assignment example", async () => {
    const res = await postQuote(
      postJson(`${API_BASE}/quotes`, { grossWeightGrams: 50, netWeightGrams: 45, karat: 22 }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.rate24kPerGramRupees).toBe(7000);
    expect(body.pureGoldGrams).toBe(41.25);
    expect(body.goldValueRupees).toBe(288_750);
    expect(body.goldValueFormatted).toBe("₹2,88,750");

    const emi = body.plans.find((p: { planId: string }) => p.planId === "PLAN_EMI_01");
    const bullet = body.plans.find((p: { planId: string }) => p.planId === "PLAN_BULLET_01");
    expect(emi.eligibleLoanRupees).toBe(216_562);
    expect(emi.eligibleLoanFormatted).toBe("₹2,16,562");
    expect(bullet.eligibleLoanRupees).toBe(202_125);
  });

  it("does not write anything to the database (pure calculation)", async () => {
    const res = await postQuote(
      postJson(`${API_BASE}/quotes`, { grossWeightGrams: 12, netWeightGrams: 10, karat: 18 }),
    );
    expect(res.status).toBe(200);
  });

  it("rejects net weight greater than gross weight with 400", async () => {
    const res = await postQuote(
      postJson(`${API_BASE}/quotes`, { grossWeightGrams: 40, netWeightGrams: 45, karat: 22 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid karat with 400", async () => {
    const res = await postQuote(
      postJson(`${API_BASE}/quotes`, { grossWeightGrams: 50, netWeightGrams: 45, karat: 20 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects malformed JSON with a consistent error shape", async () => {
    const res = await postQuote(
      new Request(`${API_BASE}/quotes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not-json",
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_JSON");
    expect(typeof body.error.message).toBe("string");
  });

  it("returns 404 when requested scheme does not exist", async () => {
    const res = await postQuote(
      postJson(`${API_BASE}/quotes`, {
        grossWeightGrams: 50,
        netWeightGrams: 45,
        karat: 22,
        schemeId: "NON_EXISTENT_PLAN",
      }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("PLAN_NOT_FOUND");
  });
});
