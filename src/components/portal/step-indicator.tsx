import { Check } from "lucide-react";
import clsx from "clsx";

const STEPS = [
  { id: "details", label: "Gold & applicant details" },
  { id: "review", label: "Review & confirm" },
  { id: "success", label: "Confirmation" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

export function StepIndicator({ current }: { current: StepId }) {
  const currentIndex = STEPS.findIndex((s) => s.id === current);
  return (
    <ol aria-label="Application progress" className="flex items-center gap-2 sm:gap-3">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";
        return (
          <li key={step.id} className="flex min-w-0 items-center gap-2 sm:gap-3">
            {index > 0 && <span aria-hidden className="h-px w-4 bg-line-2 sm:w-8" />}
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className={clsx(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold",
                  state === "done" && "bg-success text-white",
                  state === "current" && "bg-gold-deep text-white",
                  state === "todo" && "border border-line-2 text-ink-3",
                )}
              >
                {state === "done" ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={clsx(
                  "truncate text-[12.5px] leading-none sm:text-[13px]",
                  state === "current" ? "font-semibold text-ink" : "font-medium text-ink-3",
                  state === "todo" && "hidden sm:inline",
                )}
                aria-current={state === "current" ? "step" : undefined}
              >
                {step.label}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
