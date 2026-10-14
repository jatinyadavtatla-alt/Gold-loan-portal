"use client";

import { ArrowRight, MessageCircle, Table2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteHeader } from "@/components/site-header";
import { ApiClientError, fetchQuote, fetchSchemes, submitLead } from "./api";
import { AssistantPanel } from "./assistant-panel";
import { parseGrams, validateAll, weightsAreQuotable, type DetailsFields, type FieldErrors } from "./client-validation";
import { DetailsForm } from "./details-form";
import { QuotePanel, type QuoteStatus } from "./quote-panel";
import { ReviewStep, type SubmitError } from "./review-step";
import { StepIndicator, type StepId } from "./step-indicator";
import { SuccessStep } from "./success-step";
import type { LeadCreatedResponse, QuoteResponse, SchemeDto } from "./types";

const QUOTE_DEBOUNCE_MS = 300;

const EMPTY_FIELDS: DetailsFields = {
  grossWeightGrams: "",
  netWeightGrams: "",
  karat: 22,
  applicantName: "",
  mobile: "",
};

export function PortalApp() {
  const [step, setStep] = useState<StepId>("details");
  const [fields, setFields] = useState<DetailsFields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [schemes, setSchemes] = useState<SchemeDto[] | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>("idle");
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [created, setCreated] = useState<LeadCreatedResponse | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  /* Load schemes once; preselect the plan with the highest eligible amount. */
  useEffect(() => {
    const controller = new AbortController();
    fetchSchemes(controller.signal)
      .then(({ schemes }) => {
        setSchemes(schemes);
        if (schemes.length > 0) {
          const best = schemes.reduce((b, s) => (s.maxLtvPercent > b.maxLtvPercent ? s : b));
          setSelectedPlanId((current) => current ?? best.id);
        }
      })
      .catch(() => setSchemes([]));
    return () => controller.abort();
  }, []);

  /* Debounced live quote (~300 ms), with stale-request protection. */
  const { grossWeightGrams, netWeightGrams, karat } = fields;
  useEffect(() => {
    if (!weightsAreQuotable({ grossWeightGrams, netWeightGrams, karat, applicantName: "", mobile: "" })) {
      setQuote(null);
      setQuoteStatus("idle");
      return;
    }
    setQuoteStatus("loading");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchQuote(
        {
          grossWeightGrams: Number(grossWeightGrams),
          netWeightGrams: Number(netWeightGrams),
          karat,
        },
        controller.signal,
      )
        .then((result) => {
          setQuote(result);
          setQuoteStatus("ready");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setQuote(null);
          setQuoteStatus("error");
        });
    }, QUOTE_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [grossWeightGrams, netWeightGrams, karat]);

  const onFieldChange = useCallback((field: keyof DetailsFields, value: string | number) => {
    setFields((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmitError(null);
  }, []);

  const selectedPlanQuote = useMemo(
    () => quote?.plans.find((p) => p.planId === selectedPlanId) ?? null,
    [quote, selectedPlanId],
  );
  const selectedSchemeName =
    schemes?.find((s) => s.id === created?.planId)?.name ?? selectedPlanQuote?.planName ?? "";

  const goToReview = () => {
    const found = validateAll(fields);
    if (!selectedPlanId) found.planId = "Please select a loan plan.";
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      const el = document.querySelector<HTMLElement>(`[name="${first}"]`) ?? document.getElementById(first);
      el?.focus();
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setStep("review");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const confirmAndSubmit = async () => {
    if (!selectedPlanId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await submitLead({
        applicantName: fields.applicantName.trim(),
        mobile: fields.mobile.trim(),
        grossWeightGrams: parseGrams(fields.grossWeightGrams) ?? 0,
        netWeightGrams: parseGrams(fields.netWeightGrams) ?? 0,
        karat: fields.karat,
        planId: selectedPlanId,
      });
      setCreated(result);
      setStep("success");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (error instanceof ApiClientError) {
        const details = error.details as
          | { existingApplicationId?: string }
          | Array<{ path: string; message: string }>
          | undefined;
        setSubmitError({
          code: error.code,
          message: error.message,
          existingApplicationId:
            details && !Array.isArray(details) ? details.existingApplicationId : undefined,
        });
        if (error.code === "VALIDATION_ERROR" && Array.isArray(details)) {
          const mapped: FieldErrors = {};
          for (const issue of details) {
            if (issue.path in fields || issue.path === "planId") {
              mapped[issue.path as keyof FieldErrors] = issue.message;
            }
          }
          setErrors(mapped);
          setStep("details");
        }
      } else {
        setSubmitError({ code: "UNEXPECTED_ERROR", message: "Something went wrong. Please try again." });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const startNew = () => {
    setFields(EMPTY_FIELDS);
    setErrors({});
    setQuote(null);
    setQuoteStatus("idle");
    setSubmitError(null);
    setCreated(null);
    setStep("details");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const planReady = quote !== null && selectedPlanQuote !== null && quoteStatus !== "error";

  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <>
            <Link
              href="/admin"
              className="hidden h-9 items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40 sm:inline-flex"
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden />
              Applications
            </Link>
            <button
              type="button"
              onClick={() => setAssistantOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gold-deep px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#5d481a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              AI Assistant
            </button>
          </>
        }
      />

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 py-6">
          <div>
            <h1 className="font-display text-[24px] font-semibold leading-tight sm:text-[28px]">
              Apply for a gold loan
            </h1>
            <p className="mt-1 text-[13px] text-ink-3">
              Indicative valuation at the 24K reference rate of ₹7,000 / gram.
            </p>
          </div>
          <StepIndicator current={step} />
        </div>

        {step === "details" && (
          <div className="grid items-start gap-6 lg:grid-cols-[1.05fr_0.95fr]">
            <DetailsForm fields={fields} errors={errors} onChange={onFieldChange} />
            <div className="grid gap-5 lg:sticky lg:top-20">
              <QuotePanel
                schemes={schemes}
                quote={quote}
                quoteStatus={quoteStatus}
                selectedPlanId={selectedPlanId}
                onSelectPlan={(id) => {
                  setSelectedPlanId(id);
                  setErrors((current) => {
                    if (!current.planId) return current;
                    const next = { ...current };
                    delete next.planId;
                    return next;
                  });
                }}
              />
              {errors.planId && (
                <p role="alert" className="-mt-2 text-[12.5px] font-medium text-danger">
                  {errors.planId}
                </p>
              )}
              <button
                type="button"
                onClick={goToReview}
                disabled={!planReady}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-gold-deep text-[15px] font-semibold text-white transition-colors hover:bg-[#5d481a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Continue to review
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              {!planReady && (
                <p className="-mt-2 text-center text-[12px] text-ink-3">
                  Enter valid gold weights to enable review.
                </p>
              )}
            </div>
          </div>
        )}

        {step === "review" && quote && selectedPlanQuote && (
          <ReviewStep
            fields={fields}
            quote={quote}
            planQuote={selectedPlanQuote}
            submitting={submitting}
            submitError={submitError}
            onBack={() => setStep("details")}
            onConfirm={confirmAndSubmit}
          />
        )}

        {step === "success" && created && (
          <SuccessStep created={created} planName={selectedSchemeName || "Gold loan"} onStartNew={startNew} />
        )}
      </main>

      <footer className="border-t border-line py-5">
        <p className="mx-auto w-full max-w-6xl px-4 text-[11.5px] leading-relaxed text-ink-3 sm:px-6">
          Demonstration build — gold rate is a fixed mock reference, not a live market price.
          Investments and credit decisions are subject to verification. Never share OTPs with anyone.
        </p>
      </footer>

      <AssistantPanel open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
