/**
 * Display helpers shared by server responses and the UI.
 * Formatting only — no financial arithmetic happens here.
 */

const inrWhole = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plainRupees = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/**
 * Format integer paise as ₹ with Indian digit grouping.
 * Whole-rupee display is FLOORED (₹2,16,562.50 → "₹2,16,562"), matching the
 * assignment's `floor(goldValue × ltv)` rule — Intl rounding would show 563.
 */
export function formatPaiseAsINR(paise: number, options?: { withPaise?: boolean }): string {
  if (options?.withPaise) return inrWithPaise.format(paise / 100);
  return inrWhole.format(Math.floor(paise / 100));
}

export function formatRupees(rupees: number): string {
  return inrWhole.format(rupees);
}

export function formatPlainNumber(value: number): string {
  return plainRupees.format(value);
}

export function formatGrams(grams: number): string {
  const rounded = Math.round(grams * 1000) / 1000;
  return `${rounded.toLocaleString("en-IN", { maximumFractionDigits: 3 })} g`;
}

/**
 * Mask a 10-digit Indian mobile for display: 9876543210 → 98XXXXXX10.
 * Used everywhere leads are serialised; raw numbers must never be sent
 * to browsers or logs.
 */
export function maskMobile(mobile: string): string {
  let digits = mobile.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2); // +91 form
  if (!/^[6-9]\d{9}$/.test(digits)) return "XXXXXXXXXX";
  return `${digits.slice(0, 2)}XXXXXX${digits.slice(-2)}`;
}

const dateTimeIST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export function formatDateTimeIST(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? "—" : dateTimeIST.format(d);
}
