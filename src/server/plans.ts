/**
 * Data access for loan schemes. Every read runs after ensureDbReady so the
 * schema + seed exist even in a brand-new environment.
 */
import { db } from "@/db";
import { ensureDbReady, SEED_SCHEMES } from "@/db/bootstrap";
import { loanSchemes, type LoanSchemeRow } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { bpsToPercent, type PlanFinancials } from "@/lib/finance";

export interface SchemeDto {
  id: string;
  name: string;
  annualInterestRatePercent: number;
  tenureMonths: number;
  maxLtvPercent: number;
}

export function toSchemeDto(row: LoanSchemeRow): SchemeDto {
  return {
    id: row.id,
    name: row.name,
    annualInterestRatePercent: bpsToPercent(row.annualInterestRateBps),
    tenureMonths: row.tenureMonths,
    maxLtvPercent: bpsToPercent(row.maxLtvBps),
  };
}

export function toPlanFinancials(row: LoanSchemeRow): PlanFinancials {
  return {
    id: row.id,
    name: row.name,
    annualInterestRateBps: row.annualInterestRateBps,
    tenureMonths: row.tenureMonths,
    maxLtvBps: row.maxLtvBps,
  };
}

export async function getActiveSchemes(): Promise<LoanSchemeRow[]> {
  try {
    await ensureDbReady();
    return await db
      .select()
      .from(loanSchemes)
      .where(eq(loanSchemes.isActive, true))
      .orderBy(asc(loanSchemes.sortOrder), asc(loanSchemes.id));
  } catch {
    return SEED_SCHEMES.map((s) => ({
      id: s.id,
      name: s.name,
      annualInterestRateBps: s.annualInterestRateBps,
      tenureMonths: s.tenureMonths,
      maxLtvBps: s.maxLtvBps,
      sortOrder: s.sortOrder,
      isActive: true,
      createdAt: new Date(),
    }));
  }
}

export async function getSchemeById(id: string): Promise<LoanSchemeRow | undefined> {
  try {
    await ensureDbReady();
    const rows = await db
      .select()
      .from(loanSchemes)
      .where(eq(loanSchemes.id, id))
      .limit(1);
    return rows[0];
  } catch {
    const s = SEED_SCHEMES.find((item) => item.id === id);
    if (!s) return undefined;
    return {
      id: s.id,
      name: s.name,
      annualInterestRateBps: s.annualInterestRateBps,
      tenureMonths: s.tenureMonths,
      maxLtvBps: s.maxLtvBps,
      sortOrder: s.sortOrder,
      isActive: true,
      createdAt: new Date(),
    };
  }
}

