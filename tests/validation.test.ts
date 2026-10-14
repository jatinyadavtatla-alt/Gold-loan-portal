import { describe, expect, it } from "vitest";
import {
  applicantNameSchema,
  leadInputSchema,
  mobileSchema,
  quoteInputSchema,
} from "@/lib/validation";

const VALID_QUOTE = { grossWeightGrams: 50, netWeightGrams: 45, karat: 22 };
const VALID_LEAD = {
  ...VALID_QUOTE,
  applicantName: "Ananya Sharma",
  mobile: "9876543210",
  planId: "PLAN_EMI_01",
};

describe("quote input validation", () => {
  it("accepts a valid quote request", () => {
    expect(quoteInputSchema.safeParse(VALID_QUOTE).success).toBe(true);
  });

  it("rejects net weight greater than gross weight", () => {
    const result = quoteInputSchema.safeParse({ ...VALID_QUOTE, netWeightGrams: 60 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("netWeightGrams");
    }
  });

  it.each([
    { grossWeightGrams: 0 },
    { grossWeightGrams: -5 },
    { netWeightGrams: 0 },
    { grossWeightGrams: 1001 },
    { netWeightGrams: 1001 },
  ])("rejects invalid weights %o", (patch) => {
    expect(quoteInputSchema.safeParse({ ...VALID_QUOTE, ...patch }).success).toBe(false);
  });

  it.each([16, 20, 21, 23, 0, "22"])("rejects invalid karat %s", (karat) => {
    expect(quoteInputSchema.safeParse({ ...VALID_QUOTE, karat }).success).toBe(false);
  });

  it.each([18, 22, 24])("accepts karat %s", (karat) => {
    expect(quoteInputSchema.safeParse({ ...VALID_QUOTE, karat }).success).toBe(true);
  });
});

describe("lead input validation", () => {
  it("accepts a valid application", () => {
    expect(leadInputSchema.safeParse(VALID_LEAD).success).toBe(true);
  });

  it.each([
    "A", // too short
    "R4vi Kumar", // digits
    "Ravi-Kumar", // hyphen
    "Ravi  Kumar", // double space
    "x".repeat(61), // too long
  ])("rejects invalid name %j", (applicantName) => {
    expect(leadInputSchema.safeParse({ ...VALID_LEAD, applicantName }).success).toBe(false);
  });

  it.each(["Om Prakash", "Vidya S", "RK"])("accepts valid name %j", (applicantName) => {
    expect(leadInputSchema.safeParse({ ...VALID_LEAD, applicantName }).success).toBe(true);
  });

  it.each([
    "5876543210", // starts with 5
    "987654321", // 9 digits
    "98765432109", // 11 digits
    "98765abcde",
    "+919876543210",
    "",
  ])("rejects invalid mobile %j", (mobile) => {
    expect(mobileSchema.safeParse(mobile).success).toBe(false);
    expect(leadInputSchema.safeParse({ ...VALID_LEAD, mobile }).success).toBe(false);
  });

  it.each(["6000000000", "9876543210", "7001234567"])("accepts valid mobile %j", (mobile) => {
    expect(mobileSchema.safeParse(mobile).success).toBe(true);
  });

  it("requires a planId", () => {
    expect(leadInputSchema.safeParse({ ...VALID_LEAD, planId: "" }).success).toBe(false);
  });

  it("applicantName is trimmed before length checks", () => {
    expect(applicantNameSchema.safeParse("  Ravi Kumar  ").success).toBe(true);
  });
});
