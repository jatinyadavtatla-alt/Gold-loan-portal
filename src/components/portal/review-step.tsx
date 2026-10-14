"use client";

import { AlertTriangle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { formatGrams } from "@/lib/format";
import type { DetailsFields } from "./client-validation";
import type { QuotePlan, QuoteResponse } from "./types";

export interface SubmitError {
  code: string;
  message: string;
  existingApplicationId?: string;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13px] text-ink-3">{label}</dt>
      <dd className={`text-right text-[14px] font-medium text-ink ${mono ? "tnum" : ""}`}>{value}</dd>
    </div>
  );
}

export function ReviewStep({
  fields,
  quote,
  planQuote,
  submitting,
  submitError,
  onBack,
  onConfirm,
}: {
  fields: DetailsFields;
  quote: QuoteResponse;
  planQuote: QuotePlan;
  submitting: boolean;
  submitError: SubmitError | null;
  onBack: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <section className="rounded-xl border border-line bg-surface shadow-card">
        <div className="border-b border-line px-5 py-4 sm:px-7">
          <h2 className="font-display text-[17px] font-semibold">Review your application</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            Please verify every detail — this information goes into your loan agreement.
          </p>
        </div>

        <div className="grid gap-6 px-5 py-5 sm:px-7">
          <dl className="divide-y divide-line/70">
            <Row label="Applicant name" value={fields.applicantName.trim()} />
            <Row label="Mobile number" value={`+91 ${fields.mobile}`} mono />
            <Row
              label="Gold"
              value={`${formatGrams(Number(fields.grossWeightGrams))} gross · ${formatGrams(Number(fields.netWeightGrams))} net · ${fields.karat}K`}
              mono
            />
            <Row label="Pure gold content" value={formatGrams(quote.pureGoldGrams)} mono />
            <Row label="Selected plan" value={planQuote.planName} />
          </dl>

          <div className="rounded-lg border border-gold/30 bg-gold-tint/40 px-4 py-4 sm:px-5">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-ink-2">Estimated gold value</span>
              <span className="text-[14px] font-medium text-ink tnum">{quote.goldValueFormatted}</span>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between border-t border-gold/20 pt-2.5">
              <span className="text-[13px] font-semibold text-ink">Eligible loan amount</span>
              <span className="font-display text-[26px] font-semibold leading-none text-gold-deep tnum">
                {planQuote.eligibleLoanFormatted}
              </span>
            </div>
            <p className="mt-2 text-[12px] text-ink-3 tnum">
              {planQuote.planName} · {planQuote.annualInterestRatePercent}% p.a. · {planQuote.tenureMonths} months ·
              LTV {planQuote.appliedLtvPercent}%
            </p>
          </div>

          <div className="flex gap-2.5 rounded-lg border border-line bg-paper/70 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" aria-hidden />
            <p className="text-[12.5px] leading-relaxed text-ink-2">
              Amounts are recomputed on our servers at submission. The sanctioned amount may differ
              after in-branch valuation; disbursal is subject to KYC verification. Only one
              application per mobile number is allowed in 7 days.
            </p>
          </div>

          {submitError && (
            <div
              role="alert"
              className="flex gap-2.5 rounded-lg border border-danger/30 bg-danger-tint px-4 py-3"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
              <div className="text-[13px] leading-relaxed text-ink">
                <p className="font-semibold text-danger">
                  {submitError.code === "DUPLICATE_APPLICATION"
                    ? "This mobile number already has a recent application"
                    : "We couldn't submit your application"}
                </p>
                <p className="mt-1 text-ink-2">
                  {submitError.message}
                  {submitError.existingApplicationId && (
                    <>
                      {" "}
                      Your existing reference is{" "}
                      <span className="font-mono text-[12.5px] font-semibold text-ink">
                        {submitError.existingApplicationId}
                      </span>
                      . Our team will contact you on the same number.
                    </>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2.5 border-t border-line px-5 py-4 sm:flex-row sm:justify-between sm:px-7">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line-2 bg-white px-5 text-[14px] font-semibold text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Edit details
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-gold-deep px-6 text-[14px] font-semibold text-white transition-colors hover:bg-[#5d481a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Submitting…
              </>
            ) : (
              "Confirm & submit application"
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
