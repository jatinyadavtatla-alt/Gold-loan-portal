"use client";

import clsx from "clsx";
import { BadgeIndianRupee, CalendarClock, Check, Loader2, Percent } from "lucide-react";
import type { QuoteResponse, SchemeDto } from "./types";

export type QuoteStatus = "idle" | "loading" | "ready" | "error";

const PLAN_TAGLINES: Record<string, string> = {
  PLAN_EMI_01: "Fixed monthly instalments",
  PLAN_BULLET_01: "Single repayment at tenure end",
};

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-ink-3" aria-hidden>
        {icon}
      </span>
      <span className="text-[12px] text-ink-3">{label}</span>
      <span className="text-[12px] font-semibold text-ink tnum">{value}</span>
    </div>
  );
}

export function QuotePanel({
  schemes,
  quote,
  quoteStatus,
  selectedPlanId,
  onSelectPlan,
}: {
  schemes: SchemeDto[] | null;
  quote: QuoteResponse | null;
  quoteStatus: QuoteStatus;
  selectedPlanId: string | null;
  onSelectPlan: (planId: string) => void;
}) {
  const bestPlanId =
    schemes && schemes.length > 0
      ? schemes.reduce((best, s) => (s.maxLtvPercent > best.maxLtvPercent ? s : best)).id
      : null;

  return (
    <div className="grid gap-5">
      {/* Live valuation summary */}
      <section
        aria-live="polite"
        aria-label="Live gold valuation"
        className="rounded-xl border border-line bg-surface shadow-card"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            Live valuation
          </p>
          {quoteStatus === "loading" && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" aria-label="Updating valuation" />
          )}
        </div>
        <div className="px-5 py-4">
          {quote && quoteStatus !== "error" ? (
            <div className={clsx(quoteStatus === "loading" && "opacity-50 transition-opacity")}>
              <dl className="grid gap-1.5 text-[13px]">
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-3">Pure gold weight</dt>
                  <dd className="font-medium text-ink tnum">{quote.pureGoldGrams} g</dd>
                </div>
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-3">24K reference rate</dt>
                  <dd className="font-medium text-ink tnum">
                    ₹{quote.rate24kPerGramRupees.toLocaleString("en-IN")} / g
                  </dd>
                </div>
              </dl>
              <div className="mt-3 border-t border-line pt-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                  Estimated gold value
                </p>
                <p className="mt-1 font-display text-[30px] font-semibold leading-none text-gold-deep tnum">
                  {quote.goldValueFormatted}
                </p>
              </div>
            </div>
          ) : (
            <p className="py-2 text-[13px] leading-relaxed text-ink-3">
              Enter the gross and net weight of your gold to see its estimated value here.
            </p>
          )}
        </div>
      </section>

      {/* Plan comparison */}
      <section className="rounded-xl border border-line bg-surface shadow-card">
        <div className="border-b border-line px-5 py-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
            Choose your plan
          </p>
        </div>
        <div role="radiogroup" aria-label="Loan plan" className="grid gap-3 px-5 py-4">
          {(schemes ?? []).map((scheme) => {
            const selected = selectedPlanId === scheme.id;
            const planQuote = quote?.plans.find((p) => p.planId === scheme.id);
            return (
              <button
                key={scheme.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onSelectPlan(scheme.id)}
                className={clsx(
                  "relative w-full rounded-lg border px-4 py-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40",
                  selected ? "border-gold-deep bg-gold-tint/40" : "border-line-2 bg-white hover:bg-paper/50",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={clsx("text-[14.5px] font-semibold", selected ? "text-gold-deep" : "text-ink")}>
                        {scheme.name}
                      </span>
                      {scheme.id === bestPlanId && (
                        <span className="rounded-full bg-gold-tint px-2 py-0.5 text-[10.5px] font-semibold text-gold-deep">
                          Higher eligible amount
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[12px] text-ink-3">
                      {PLAN_TAGLINES[scheme.id] ?? "Gold loan plan"}
                    </p>
                  </div>
                  {selected && (
                    <span className="flex items-center gap-1 rounded-full bg-gold-deep px-2 py-1 text-[10.5px] font-semibold text-white">
                      <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                      Selected
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-baseline justify-between border-t border-line/80 pt-2.5">
                  <span className="text-[11.5px] text-ink-3">You can borrow up to</span>
                  {planQuote && quoteStatus !== "error" ? (
                    <span className="font-display text-[20px] font-semibold text-gold-deep tnum">
                      {planQuote.eligibleLoanFormatted}
                    </span>
                  ) : (
                    <span className="tnum text-[15px] font-medium text-ink-3">—</span>
                  )}
                </div>

                <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1.5">
                  <Fact
                    icon={<Percent className="h-3.5 w-3.5" />}
                    label="Interest"
                    value={`${scheme.annualInterestRatePercent}% p.a.`}
                  />
                  <Fact
                    icon={<CalendarClock className="h-3.5 w-3.5" />}
                    label="Tenure"
                    value={`${scheme.tenureMonths} months`}
                  />
                  <Fact
                    icon={<BadgeIndianRupee className="h-3.5 w-3.5" />}
                    label="Max LTV"
                    value={`${scheme.maxLtvPercent}%`}
                  />
                </div>
              </button>
            );
          })}
          {schemes === null && (
            <div className="grid gap-3" aria-hidden>
              <div className="h-[130px] animate-pulse rounded-lg bg-paper" />
              <div className="h-[130px] animate-pulse rounded-lg bg-paper" />
            </div>
          )}
        </div>
        <p className="border-t border-line px-5 py-3 text-[11.5px] leading-relaxed text-ink-3">
          Eligible amounts are computed securely on our servers at the 24K reference rate. Final
          sanction is subject to in-branch valuation and KYC.
        </p>
      </section>
    </div>
  );
}
