import { beforeEach, describe, expect, it } from "vitest";
import { GET as listLeads, POST as createLead } from "@/app/api/v1/leads/route";
import { ensureDbReady } from "@/db/bootstrap";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { API_BASE, postJson, uniqueMobile } from "./helpers";

const BASE = {
  applicantName: "Rohit Verma",
  grossWeightGrams: 50,
  netWeightGrams: 45,
  karat: 22,
  planId: "PLAN_EMI_01",
};

import { clearMemoryLeads } from "@/server/leads";

beforeEach(async () => {
  clearMemoryLeads();
  try {
    await ensureDbReady();
    await db.delete(leads);
  } catch {
    // DB offline, using memory
  }
});

describe("POST /api/v1/leads", () => {
  it("creates an application, returns 201 with an applicationId", async () => {
    const mobile = uniqueMobile();
    const res = await createLead(postJson(`${API_BASE}/leads`, { ...BASE, mobile }));
    expect(res.status).toBe(201);
    const body = await res.json();

    expect(body.applicationId).toMatch(/^GL-\d{8}-[A-Z2-9]{6}$/);
    expect(body.status).toBe("SUBMITTED");
    expect(body.maskedMobile).toBe(`${mobile.slice(0, 2)}XXXXXX${mobile.slice(-2)}`);
    // Server-recalculated quote for 45 g / 22K / EMI:
    expect(body.eligibleLoanFormatted).toBe("₹2,16,562");
  });

  it("rejects a repeat application from the same mobile within 7 days (409 + existing id)", async () => {
    const mobile = uniqueMobile();
    const first = await createLead(postJson(`${API_BASE}/leads`, { ...BASE, mobile }));
    expect(first.status).toBe(201);
    const firstBody = await first.json();

    const second = await createLead(postJson(`${API_BASE}/leads`, { ...BASE, mobile }));
    expect(second.status).toBe(409);
    const secondBody = await second.json();
    expect(secondBody.error.code).toBe("DUPLICATE_APPLICATION");
    expect(secondBody.error.details.existingApplicationId).toBe(firstBody.applicationId);
  });

  it("rejects an unknown plan with 404", async () => {
    const res = await createLead(
      postJson(`${API_BASE}/leads`, { ...BASE, mobile: uniqueMobile(), planId: "PLAN_DOES_NOT_EXIST" }),
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("PLAN_NOT_FOUND");
  });

  it("rejects invalid inputs with 400 and per-field details", async () => {
    const res = await createLead(
      postJson(`${API_BASE}/leads`, { ...BASE, mobile: "12345", applicantName: "R", netWeightGrams: 60 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    const paths = body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toContain("applicantName");
    expect(paths).toContain("mobile");
    expect(paths).toContain("netWeightGrams");
  });

  it("replaying the same idempotency key returns the existing application without duplicating", async () => {
    const mobile = uniqueMobile();
    const idempotencyKey = "idem-test-" + Date.now();
    const req1 = new Request(`${API_BASE}/leads`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({ ...BASE, mobile }),
    });
    const res1 = await createLead(req1);
    expect(res1.status).toBe(201);
    const body1 = await res1.json();

    const req2 = new Request(`${API_BASE}/leads`, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({ ...BASE, mobile }),
    });
    const res2 = await createLead(req2);
    expect(res2.status).toBe(201);
    const body2 = await res2.json();
    expect(body2.applicationId).toBe(body1.applicationId);
  });
});

describe("GET /api/v1/leads", () => {
  it("lists leads newest first with mobiles always masked", async () => {
    const mobileA = uniqueMobile();
    const mobileB = uniqueMobile();
    await createLead(postJson(`${API_BASE}/leads`, { ...BASE, mobile: mobileA, applicantName: "First Person" }));
    await new Promise((r) => setTimeout(r, 20));
    await createLead(postJson(`${API_BASE}/leads`, { ...BASE, mobile: mobileB, applicantName: "Second Person", planId: "PLAN_BULLET_01" }));

    const res = await listLeads(new Request(`${API_BASE}/leads`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.leads[0].applicantName).toBe("Second Person"); // newest first
    expect(body.leads[1].applicantName).toBe("First Person");

    for (const lead of body.leads) {
      expect(lead.maskedMobile).toMatch(/^\d{2}XXXXXX\d{2}$/);
      expect(lead.mobile).toBeUndefined();
    }
    // The full mobile number must appear NOWHERE in the payload.
    const raw = JSON.stringify(body);
    expect(raw.includes(mobileA)).toBe(false);
    expect(raw.includes(mobileB)).toBe(false);
  });

  it("supports filtering by plan", async () => {
    await createLead(postJson(`${API_BASE}/leads`, { ...BASE, mobile: uniqueMobile() }));
    await createLead(postJson(`${API_BASE}/leads`, { ...BASE, mobile: uniqueMobile(), planId: "PLAN_BULLET_01" }));

    const res = await listLeads(new Request(`${API_BASE}/leads?plan=PLAN_BULLET_01`));
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.leads[0].planId).toBe("PLAN_BULLET_01");
    expect(body.leads[0].planName).toBe("Bullet Repayment");
  });
});
