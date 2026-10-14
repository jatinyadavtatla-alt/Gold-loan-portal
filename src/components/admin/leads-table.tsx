"use client";

import clsx from "clsx";
import { Inbox } from "lucide-react";
import { formatDateTimeIST, formatPaiseAsINR } from "@/lib/format";
import type { LeadListItem } from "@/components/portal/types";

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: "bg-gold-tint text-gold-deep",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        STATUS_STYLES[status] ?? "bg-paper text-ink-2 border border-line-2",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden />
      {status}
    </span>
  );
}

export function LeadsTable({
  leads,
  loading,
  filtered,
}: {
  leads: LeadListItem[];
  loading: boolean;
  filtered: boolean;
}) {
  if (loading) {
    return (
      <div className="divide-y divide-line/70" aria-label="Loading applications">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="grid grid-cols-6 gap-4 px-5 py-4">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="h-4 animate-pulse rounded bg-paper" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center px-5 py-14 text-center">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-paper">
          <Inbox className="h-5 w-5 text-ink-3" aria-hidden />
        </span>
        <p className="mt-3 text-[14px] font-semibold text-ink">No applications found</p>
        <p className="mt-1 text-[12.5px] text-ink-3">
          {filtered
            ? "No applications match this plan filter. Try a different plan."
            : "New gold loan applications will appear here as they are submitted."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-left">
        <thead>
          <tr className="border-b border-line bg-paper/60">
            {["Application", "Applicant", "Mobile", "Net gold", "Plan", "Eligible loan", "Status"].map((h) => (
              <th
                key={h}
                scope="col"
                className={clsx(
                  "px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3",
                  h === "Eligible loan" && "text-right",
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/70">
          {leads.map((lead) => (
            <tr key={lead.applicationId} className="transition-colors hover:bg-paper/50">
              <td className="px-5 py-3.5 align-top">
                <span className="block font-mono text-[12.5px] font-semibold text-ink">
                  {lead.applicationId}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-ink-3 tnum">
                  {formatDateTimeIST(lead.createdAt)}
                </span>
              </td>
              <td className="px-5 py-3.5 align-top text-[13.5px] font-medium text-ink">
                {lead.applicantName}
              </td>
              <td className="px-5 py-3.5 align-top font-mono text-[12.5px] text-ink-2 tnum">
                {lead.maskedMobile}
              </td>
              <td className="px-5 py-3.5 align-top text-[13px] text-ink tnum">
                {lead.netWeightGrams} g
                <span className="ml-1.5 rounded bg-paper px-1.5 py-0.5 text-[10.5px] font-semibold text-ink-2">
                  {lead.karat}K
                </span>
              </td>
              <td className="px-5 py-3.5 align-top text-[13px] text-ink">{lead.planName}</td>
              <td className="px-5 py-3.5 align-top text-right text-[13.5px] font-semibold text-gold-deep tnum">
                {formatPaiseAsINR(lead.eligibleLoanPaise)}
              </td>
              <td className="px-5 py-3.5 align-top">
                <StatusBadge status={lead.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
