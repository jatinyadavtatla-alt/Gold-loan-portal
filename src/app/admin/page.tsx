"use client";

import { ArrowLeft, RefreshCw, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { LeadsTable } from "@/components/admin/leads-table";
import { fetchLeads, fetchSchemes } from "@/components/portal/api";
import type { LeadListItem, SchemeDto } from "@/components/portal/types";
import { SiteHeader } from "@/components/site-header";

/**
 * Applications admin dashboard.
 *
 * SECURITY NOTE (also documented in README): this page and GET /api/v1/leads
 * are intentionally UNAUTHENTICATED in this demonstration build. A hidden URL
 * is not security — any production deployment MUST protect both the page and
 * the API with authentication and role-based authorization.
 */
export default function AdminPage() {
  const [leads, setLeads] = useState<LeadListItem[]>([]);
  const [schemes, setSchemes] = useState<SchemeDto[]>([]);
  const [planFilter, setPlanFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (plan: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchLeads(plan || undefined);
      setLeads(result.leads);
    } catch {
      setError("Couldn't load applications. Check the connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchemes().then((r) => setSchemes(r.schemes)).catch(() => setSchemes([]));
  }, []);

  useEffect(() => {
    void load(planFilter);
  }, [planFilter, load]);

  return (
    <div className="min-h-screen">
      <SiteHeader
        right={
          <Link
            href="/"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line-2 bg-surface px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Application form
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3 py-6">
          <div>
            <h1 className="font-display text-[24px] font-semibold leading-tight sm:text-[28px]">
              Applications
            </h1>
            <p className="mt-1 text-[13px] text-ink-3">
              {loading ? "Loading…" : `${leads.length} application${leads.length === 1 ? "" : "s"} · newest first · mobiles masked`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="plan-filter" className="sr-only">
              Filter by plan
            </label>
            <select
              id="plan-filter"
              value={planFilter}
              onChange={(e) => setPlanFilter(e.target.value)}
              className="h-9 rounded-lg border border-line-2 bg-surface px-2.5 text-[13px] font-medium text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              <option value="">All plans</option>
              {schemes.map((scheme) => (
                <option key={scheme.id} value={scheme.id}>
                  {scheme.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void load(planFilter)}
              aria-label="Refresh applications"
              className="grid h-9 w-9 place-items-center rounded-lg border border-line-2 bg-surface text-ink-2 transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            </button>
          </div>
        </div>

        <div
          role="note"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-gold/40 bg-gold-tint/50 px-4 py-3"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-deep" aria-hidden />
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            <span className="font-semibold text-gold-deep">Demo access:</span> this dashboard and the
            leads API are unauthenticated in this build. A hidden URL is not security — production
            deployments must add authentication and role-based authorization (see README).
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-5 rounded-lg border border-danger/30 bg-danger-tint px-4 py-3 text-[13px] font-medium text-danger">
            {error}
            <button
              type="button"
              onClick={() => void load(planFilter)}
              className="ml-2 underline underline-offset-2 hover:text-ink"
            >
              Retry
            </button>
          </div>
        )}

        <section className="rounded-xl border border-line bg-surface shadow-card">
          <LeadsTable leads={leads} loading={loading} filtered={planFilter !== ""} />
        </section>
      </main>
    </div>
  );
}
