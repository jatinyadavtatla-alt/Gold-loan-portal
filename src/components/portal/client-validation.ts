/**
 * Client-side validation for instant inline feedback ONLY.
 * The server re-validates everything with the shared Zod schemas — these
 * checks exist purely for UX and never replace server validation.
 */

export interface DetailsFields {
  grossWeightGrams: string;
  netWeightGrams: string;
  karat: number;
  applicantName: string;
  mobile: string;
}

export type FieldErrors = Partial<Record<keyof DetailsFields | "planId", string>>;

const NAME_RE = /^[A-Za-z]+( [A-Za-z]+)*$/;
const MOBILE_RE = /^[6-9]\d{9}$/;

export function parseGrams(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function validateWeightFields(fields: DetailsFields): FieldErrors {
  const errors: FieldErrors = {};
  const gross = parseGrams(fields.grossWeightGrams);
  const net = parseGrams(fields.netWeightGrams);

  if (gross === null || gross <= 0) errors.grossWeightGrams = "Enter the gross weight (more than 0 g).";
  else if (gross > 1000) errors.grossWeightGrams = "Gross weight cannot exceed 1000 g.";

  if (net === null || net <= 0) errors.netWeightGrams = "Enter the net gold weight (more than 0 g).";
  else if (net > 1000) errors.netWeightGrams = "Net weight cannot exceed 1000 g.";
  else if (gross !== null && gross > 0 && net > gross)
    errors.netWeightGrams = "Net weight cannot be greater than gross weight.";

  return errors;
}

/** Are weight inputs complete & consistent enough to request a live quote? */
export function weightsAreQuotable(fields: DetailsFields): boolean {
  return Object.keys(validateWeightFields(fields)).length === 0;
}

export function validateAll(fields: DetailsFields): FieldErrors {
  const errors = validateWeightFields(fields);

  const name = fields.applicantName.trim();
  if (name.length < 2) errors.applicantName = "Enter the applicant's full name (at least 2 characters).";
  else if (name.length > 60) errors.applicantName = "Name must be at most 60 characters.";
  else if (!NAME_RE.test(name)) errors.applicantName = "Name can contain only letters and single spaces.";

  if (!MOBILE_RE.test(fields.mobile.trim()))
    errors.mobile = "Enter a valid 10-digit Indian mobile number (starts with 6–9).";

  return errors;
}
