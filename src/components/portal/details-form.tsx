"use client";

import clsx from "clsx";
import type { ReactNode } from "react";
import type { DetailsFields, FieldErrors } from "./client-validation";

const PURITY_OPTIONS = [
  { karat: 18, label: "18K", purity: "75.0% pure" },
  { karat: 22, label: "22K", purity: "91.6% pure" },
  { karat: 24, label: "24K", purity: "99.9% pure" },
] as const;

const inputBase =
  "h-11 w-full rounded-lg border bg-white px-3 text-[15px] text-ink tnum placeholder:text-ink-3/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 transition-colors";

function inputClass(hasError: boolean) {
  return clsx(inputBase, hasError ? "border-danger/60" : "border-line-2 focus-visible:border-gold");
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[12.5px] font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

function sanitizeDecimal(value: string): string {
  if (value === "") return "";
  return /^\d*\.?\d*$/.test(value) ? value : value.slice(0, -1);
}

export function DetailsForm({
  fields,
  errors,
  onChange,
}: {
  fields: DetailsFields;
  errors: FieldErrors;
  onChange: (field: keyof DetailsFields, value: string | number) => void;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface shadow-card">
      <div className="border-b border-line px-5 py-4 sm:px-6">
        <h2 className="font-display text-[17px] font-semibold">Gold details</h2>
        <p className="mt-0.5 text-[12.5px] text-ink-3">
          Valuation below is indicative; the final amount is confirmed at branch valuation.
        </p>
      </div>

      <div className="grid gap-5 px-5 py-5 sm:px-6">
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Gold purity</legend>
          <div role="radiogroup" aria-label="Gold purity" className="grid grid-cols-3 gap-2">
            {PURITY_OPTIONS.map((option) => {
              const selected = fields.karat === option.karat;
              return (
                <button
                  key={option.karat}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange("karat", option.karat)}
                  className={clsx(
                    "rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
                    selected
                      ? "border-gold-deep bg-gold-tint/60"
                      : "border-line-2 bg-white hover:border-line-2 hover:bg-paper/60",
                  )}
                >
                  <span className={clsx("block text-[15px] font-semibold", selected ? "text-gold-deep" : "text-ink")}>
                    {option.label}
                  </span>
                  <span className="block text-[11.5px] text-ink-3">{option.purity}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="gross-weight"
            label="Gross weight (grams)"
            hint="Total ornament weight, including stones."
            error={errors.grossWeightGrams}
          >
            <input
              id="gross-weight"
              name="grossWeightGrams"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 50"
              value={fields.grossWeightGrams}
              onChange={(e) => onChange("grossWeightGrams", sanitizeDecimal(e.target.value))}
              aria-invalid={Boolean(errors.grossWeightGrams)}
              aria-describedby={errors.grossWeightGrams ? "gross-weight-error" : undefined}
              className={inputClass(Boolean(errors.grossWeightGrams))}
            />
          </Field>
          <Field
            id="net-weight"
            label="Net gold weight (grams)"
            hint="Gold content after removing stones & clasps."
            error={errors.netWeightGrams}
          >
            <input
              id="net-weight"
              name="netWeightGrams"
              inputMode="decimal"
              autoComplete="off"
              placeholder="e.g. 45"
              value={fields.netWeightGrams}
              onChange={(e) => onChange("netWeightGrams", sanitizeDecimal(e.target.value))}
              aria-invalid={Boolean(errors.netWeightGrams)}
              aria-describedby={errors.netWeightGrams ? "net-weight-error" : undefined}
              className={inputClass(Boolean(errors.netWeightGrams))}
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-line px-5 py-4 sm:px-6">
        <h3 className="font-display text-[15.5px] font-semibold">Applicant details</h3>
      </div>
      <div className="grid gap-5 px-5 pb-6 sm:grid-cols-2 sm:px-6">
        <Field id="applicant-name" label="Full name" error={errors.applicantName}>
          <input
            id="applicant-name"
            name="applicantName"
            type="text"
            autoComplete="name"
            placeholder="e.g. Ananya Sharma"
            value={fields.applicantName}
            onChange={(e) => onChange("applicantName", e.target.value.slice(0, 60))}
            aria-invalid={Boolean(errors.applicantName)}
            aria-describedby={errors.applicantName ? "applicant-name-error" : undefined}
            className={inputClass(Boolean(errors.applicantName))}
          />
        </Field>
        <Field
          id="mobile"
          label="Mobile number"
          hint="We'll send application updates to this number."
          error={errors.mobile}
        >
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[15px] text-ink-3 tnum"
            >
              +91
            </span>
            <input
              id="mobile"
              name="mobile"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              value={fields.mobile}
              onChange={(e) => onChange("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))}
              aria-invalid={Boolean(errors.mobile)}
              aria-describedby={errors.mobile ? "mobile-error" : undefined}
              className={clsx(inputClass(Boolean(errors.mobile)), "pl-12")}
            />
          </div>
        </Field>
      </div>
    </section>
  );
}
