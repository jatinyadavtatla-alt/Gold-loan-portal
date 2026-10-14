/**
 * Lead (application) service.
 *
 * Security rules enforced here — never in the browser:
 *  - The quote is ALWAYS recalculated on the server from raw inputs; any
 *    amounts sent by a client (or an AI model) are ignored.
 *  - A second application from the same mobile within 7 days is rejected
 *    with HTTP 409 and the existing applicationId.
 *  - Every read path masks mobile numbers via maskMobile().
 */
import { db } from "@/db";
import { ensureDbReady } from "@/db/bootstrap";
import { leads as leadsTable, type LeadRow } from "@/db/schema";
import { and, desc, eq, gt, ilike, or, sql } from "drizzle-orm";
import { ApiError, ErrorCodes } from "@/lib/api-errors";
import { newApplicationId } from "@/lib/application-id";
import {
  computeQuote,
  gramsToMilligrams,
  type QuoteResult,
} from "@/lib/finance";
import { maskMobile } from "@/lib/format";
import type { LeadInputParsed } from "@/lib/validation";
import { getSchemeById } from "@/server/plans";
import { toPlanFinancials } from "@/server/plans";

const DUPLICATE_WINDOW_DAYS = 7;

export interface CreatedLead {
  lead: LeadRow;
  quote: QuoteResult;
}

/** Serialised lead for admin lists — mobile ALWAYS masked here. */
export interface LeadListItem {
  applicationId: string;
  applicantName: string;
  maskedMobile: string;
  grossWeightGrams: number;
  netWeightGrams: number;
  karat: number;
  planId: string;
  planName: string;
  pureGoldGrams: number;
  eligibleLoanPaise: number;
  eligibleLoanRupees: number;
  status: string;
  createdAt: string;
}

const memoryLeads: LeadRow[] = [];

export function clearMemoryLeads() {
  memoryLeads.length = 0;
}

export async function findRecentApplicationByMobile(mobile: string): Promise<LeadRow | undefined> {
  const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  try {
    await ensureDbReady();
    const rows = await db
      .select()
      .from(leadsTable)
      .where(and(eq(leadsTable.mobile, mobile), gt(leadsTable.createdAt, since)))
      .orderBy(desc(leadsTable.createdAt))
      .limit(1);
    return rows[0];
  } catch {
    return memoryLeads
      .filter((l) => l.mobile === mobile && l.createdAt > since)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  }
}

export async function createLead(
  input: LeadInputParsed,
  idempotencyKey?: string,
): Promise<CreatedLead> {
  const scheme = await getSchemeById(input.planId);
  if (!scheme || !scheme.isActive) {
    throw new ApiError(
      404,
      ErrorCodes.PLAN_NOT_FOUND,
      "The selected loan plan does not exist or is no longer active.",
    );
  }

  // Authoritative server-side calculation — client amounts are never trusted.
  const quote = computeQuote(
    { netWeightGrams: input.netWeightGrams, karat: input.karat },
    [toPlanFinancials(scheme)],
  );
  const planQuote = quote.plans[0];

  try {
    await ensureDbReady();
    return await db.transaction(async (tx) => {
      // 1. Idempotency check: if the same key was already processed, return the existing lead.
      if (idempotencyKey) {
        const existing = await tx
          .select()
          .from(leadsTable)
          .where(eq(leadsTable.idempotencyKey, idempotencyKey))
          .limit(1);
        if (existing[0]) {
          return { lead: existing[0], quote };
        }
      }

      // 2. Transactional advisory lock on hashtext(mobile).
      // This serializes concurrent submissions for the exact same mobile number,
      // making the 7-day duplicate check atomic and race-condition free at the DB level.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${input.mobile}))`);

      // 3. Duplicate check within transaction
      const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      const duplicates = await tx
        .select()
        .from(leadsTable)
        .where(and(eq(leadsTable.mobile, input.mobile), gt(leadsTable.createdAt, since)))
        .orderBy(desc(leadsTable.createdAt))
        .limit(1);

      if (duplicates[0]) {
        throw new ApiError(
          409,
          ErrorCodes.DUPLICATE_APPLICATION,
          "An application from this mobile number was submitted in the last 7 days.",
          { existingApplicationId: duplicates[0].applicationId },
        );
      }

      // 4. Insert lead with retry on rare applicationId collision
      let created: LeadRow | undefined;
      for (let attempt = 0; attempt < 2 && !created; attempt += 1) {
        try {
          const rows = await tx
            .insert(leadsTable)
            .values({
              applicationId: newApplicationId(),
              applicantName: input.applicantName,
              mobile: input.mobile,
              grossWeightMg: gramsToMilligrams(input.grossWeightGrams),
              netWeightMg: gramsToMilligrams(input.netWeightGrams),
              karat: input.karat,
              planId: scheme.id,
              pureGoldGrams: quote.pureGoldGrams.toFixed(3),
              goldValuePaise: quote.goldValuePaise,
              eligibleLoanPaise: planQuote.eligibleLoanPaise,
              status: "SUBMITTED",
              idempotencyKey: idempotencyKey || null,
            })
            .returning();
          created = rows[0];
        } catch (error) {
          const isUniqueViolation =
            typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
          if (!isUniqueViolation || attempt === 1) throw error;
        }
      }

      if (!created) {
        throw new ApiError(500, ErrorCodes.INTERNAL_ERROR, "Could not save the application.");
      }

      return { lead: created, quote };
    });
  } catch (error) {
    if (error instanceof ApiError && error.code !== ErrorCodes.DATABASE_UNAVAILABLE) throw error;

    // Database offline fallback for unit tests and local preview without DB:
    if (idempotencyKey) {
      const existing = memoryLeads.find((l) => l.idempotencyKey === idempotencyKey);
      if (existing) return { lead: existing, quote };
    }

    const since = new Date(Date.now() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const dup = memoryLeads.find((l) => l.mobile === input.mobile && l.createdAt > since);
    if (dup) {
      throw new ApiError(
        409,
        ErrorCodes.DUPLICATE_APPLICATION,
        "An application from this mobile number was submitted in the last 7 days.",
        { existingApplicationId: dup.applicationId },
      );
    }

    const lead: LeadRow = {
      id: crypto.randomUUID(),
      applicationId: newApplicationId(),
      applicantName: input.applicantName,
      mobile: input.mobile,
      grossWeightMg: gramsToMilligrams(input.grossWeightGrams),
      netWeightMg: gramsToMilligrams(input.netWeightGrams),
      karat: input.karat,
      planId: scheme.id,
      pureGoldGrams: quote.pureGoldGrams.toFixed(3),
      goldValuePaise: quote.goldValuePaise,
      eligibleLoanPaise: planQuote.eligibleLoanPaise,
      status: "SUBMITTED",
      idempotencyKey: idempotencyKey || null,
      createdAt: new Date(),
    };
    memoryLeads.unshift(lead);
    return { lead, quote };
  }
}

export function toLeadListItem(row: LeadRow, planName: string): LeadListItem {
  return {
    applicationId: row.applicationId,
    applicantName: row.applicantName,
    maskedMobile: maskMobile(row.mobile),
    grossWeightGrams: row.grossWeightMg / 1000,
    netWeightGrams: row.netWeightMg / 1000,
    karat: row.karat,
    planId: row.planId,
    planName,
    pureGoldGrams: Number(row.pureGoldGrams),
    eligibleLoanPaise: row.eligibleLoanPaise,
    eligibleLoanRupees: Math.floor(row.eligibleLoanPaise / 100),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listLeads(planId?: string, search?: string): Promise<LeadListItem[]> {
  try {
    await ensureDbReady();
    const { loanSchemes } = await import("@/db/schema");

    const conditions = [];
    if (planId) {
      conditions.push(eq(leadsTable.planId, planId));
    }
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(ilike(leadsTable.applicantName, term), ilike(leadsTable.applicationId, term)));
    }

    const query = db.select().from(leadsTable);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(desc(leadsTable.createdAt)).limit(200)
      : await query.orderBy(desc(leadsTable.createdAt)).limit(200);

    const schemes = await db.select().from(loanSchemes);
    const nameByPlan = new Map(schemes.map((s) => [s.id, s.name]));
    return rows.map((row) => toLeadListItem(row, nameByPlan.get(row.planId) ?? row.planId));
  } catch {
    let filtered = [...memoryLeads];
    if (planId) {
      filtered = filtered.filter((l) => l.planId === planId);
    }
    if (search && search.trim()) {
      const term = search.trim().toLowerCase();
      filtered = filtered.filter(
        (l) => l.applicantName.toLowerCase().includes(term) || l.applicationId.toLowerCase().includes(term),
      );
    }
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const nameByPlan = new Map([
      ["PLAN_BULLET_01", "Bullet Repayment"],
      ["PLAN_EMI_01", "Monthly EMI"],
    ]);
    return filtered.map((row) => toLeadListItem(row, nameByPlan.get(row.planId) ?? row.planId));
  }
}


