"use client";

import { Check, Copy, ListChecks } from "lucide-react";
import { useState } from "react";
import { formatDateTimeIST } from "@/lib/format";
import type { LeadCreatedResponse } from "./types";

export function SuccessStep({
  created,
  planName,
  onStartNew,
}: {
  created: LeadCreatedResponse;
  planName: string;
  onStartNew: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(created.applicationId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the ID is selectable text anyway */
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <section className="rounded-xl border border-line bg-surface shadow-card">
        <div className="flex flex-col items-center border-b border-line px-5 pt-8 pb-6 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-success-tint">
            <Check className="h-6 w-6 text-success" strokeWidth={2.5} aria-hidden />
          </span>
          <h2 className="mt-4 font-display text-[22px] font-semibold">Application submitted</h2>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-3">
            Your gold loan application has been received. Save the reference number below — our
            team will call {created.maskedMobile} within one business day.
          </p>

          <div className="mt-5 flex items-center gap-2 rounded-lg border border-line-2 bg-paper px-4 py-2.5">
            <span className="font-mono text-[17px] font-semibold tracking-wide text-ink">
              {created.applicationId}
            </span>
            <button
              type="button"
              onClick={copyId}
              className="ml-1 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-semibold text-gold-deep transition-colors hover:bg-gold-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
              aria-label="Copy application reference number"
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-b border-line px-5 py-5 sm:grid-cols-4 sm:px-7">
          {[
            { label: "Plan", value: planName },
            { label: "Eligible loan", value: created.eligibleLoanFormatted, accent: true },
            { label: "Gold value", value: created.goldValueFormatted },
            { label: "Submitted", value: formatDateTimeIST(created.createdAt) },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{item.label}</dt>
              <dd
                className={`mt-1 text-[13.5px] font-semibold tnum ${"accent" in item && item.accent ? "text-gold-deep" : "text-ink"}`}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="px-5 py-5 sm:px-7">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            <ListChecks className="h-3.5 w-3.5" aria-hidden />
            What happens next
          </p>
          <ol className="mt-3 grid gap-2.5">
            {[
              "Visit your nearest Aurum branch with the gold ornaments within 3 working days.",
              "Carry one KYC document — Aadhaar, PAN, or a valid passport.",
              "Our valuer certifies purity & weight, and the final sanctioned amount is confirmed.",
              "On acceptance, the loan is disbursed to your bank account the same day.",
            ].map((text, index) => (
              <li key={index} className="flex gap-3 text-[13px] leading-relaxed text-ink-2">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-2 text-[10.5px] font-semibold text-ink-3">
                  {index + 1}
                </span>
                {text}
              </li>
            ))}
          </ol>
        </div>

        <div className="border-t border-line px-5 py-4 sm:px-7">
          <button
            type="button"
            onClick={onStartNew}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-line-2 bg-white px-5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            Start another application
          </button>
        </div>
      </section>
    </div>
  );
}
