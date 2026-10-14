/**
 * Idempotent database bootstrap: creates the tables if they do not exist and
 * (re)seeds the loan schemes. It runs lazily on first API use, from
 * `npm run db:seed`, and from the Vitest global setup — so every environment
 * (preview, tests, a fresh clone) converges to the same schema without a
 * separate migration step.
 */
import { db, isDatabaseConfigured } from "@/db";
import { sql } from "drizzle-orm";
import { ApiError, ErrorCodes } from "@/lib/api-errors";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS loan_schemes (
  id text PRIMARY KEY,
  name text NOT NULL,
  annual_interest_rate_bps integer NOT NULL,
  tenure_months integer NOT NULL,
  max_ltv_bps integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id text NOT NULL UNIQUE,
  applicant_name text NOT NULL,
  mobile text NOT NULL,
  gross_weight_mg integer NOT NULL,
  net_weight_mg integer NOT NULL,
  karat integer NOT NULL,
  plan_id text NOT NULL REFERENCES loan_schemes(id),
  pure_gold_grams numeric(10, 3) NOT NULL,
  gold_value_paise bigint NOT NULL,
  eligible_loan_paise bigint NOT NULL,
  status text NOT NULL DEFAULT 'SUBMITTED',
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_mobile_created_idx ON leads (mobile, created_at);
CREATE INDEX IF NOT EXISTS leads_plan_idx ON leads (plan_id);
CREATE INDEX IF NOT EXISTS leads_idempotency_idx ON leads (idempotency_key);
`;

/** Assignment-mandated seed plans. Interest/LTV stored as basis points. */
export const SEED_SCHEMES = [
  { id: "PLAN_BULLET_01", name: "Bullet Repayment", annualInterestRateBps: 1200, tenureMonths: 12, maxLtvBps: 7000, sortOrder: 2 },
  { id: "PLAN_EMI_01", name: "Monthly EMI", annualInterestRateBps: 1050, tenureMonths: 12, maxLtvBps: 7500, sortOrder: 1 },
] as const;

const SEED_SQL = `
INSERT INTO loan_schemes (id, name, annual_interest_rate_bps, tenure_months, max_ltv_bps, sort_order, is_active)
VALUES
  ('PLAN_BULLET_01', 'Bullet Repayment', 1200, 12, 7000, 2, true),
  ('PLAN_EMI_01', 'Monthly EMI', 1050, 12, 7500, 1, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  annual_interest_rate_bps = EXCLUDED.annual_interest_rate_bps,
  tenure_months = EXCLUDED.tenure_months,
  max_ltv_bps = EXCLUDED.max_ltv_bps,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;
`;

let ready: Promise<void> | null = null;

export function ensureDbReady(): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new ApiError(
      503,
      ErrorCodes.DATABASE_UNAVAILABLE,
      "PostgreSQL connection (DATABASE_URL) is not configured. Please set DATABASE_URL in your .env file.",
    );
  }

  ready ??= (async () => {
    try {
      await db.execute(sql.raw(SCHEMA_SQL));
      await db.execute(sql.raw(SEED_SQL));
    } catch (error) {
      ready = null; // allow retry on next call if DB starts up later
      const msg = error instanceof Error ? error.message : String(error);
      throw new ApiError(
        503,
        ErrorCodes.DATABASE_UNAVAILABLE,
        `PostgreSQL database is currently unavailable: ${msg}. Please verify your database connection.`,
      );
    }
  })();
  return ready;
}

