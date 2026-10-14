import { describe, expect, it } from "vitest";
import { formatGrams, formatPaiseAsINR, maskMobile } from "@/lib/format";

describe("formatPaiseAsINR", () => {
  it("floors whole-rupee display (assignment rounding rule)", () => {
    // 216562.50 must display as ₹2,16,562 — not the rounded ₹2,16,563.
    expect(formatPaiseAsINR(21_656_250)).toBe("₹2,16,562");
    expect(formatPaiseAsINR(28_875_000)).toBe("₹2,88,750");
    expect(formatPaiseAsINR(99)).toBe("₹0");
  });

  it("can show exact paise when asked", () => {
    expect(formatPaiseAsINR(21_656_250, { withPaise: true })).toBe("₹2,16,562.50");
  });
});

describe("maskMobile", () => {
  it("masks the middle six digits", () => {
    expect(maskMobile("9876543210")).toBe("98XXXXXX10");
    expect(maskMobile("+91 98765 43210")).toBe("98XXXXXX10");
  });

  it("never leaks digits of malformed numbers", () => {
    expect(maskMobile("12345")).toBe("XXXXXXXXXX");
  });
});

describe("formatGrams", () => {
  it("formats grams with at most three decimals", () => {
    expect(formatGrams(41.25)).toBe("41.25 g");
    expect(formatGrams(7.5)).toBe("7.5 g");
  });
});
