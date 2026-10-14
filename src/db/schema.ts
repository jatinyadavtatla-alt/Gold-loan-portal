import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  numeric,
  bigint,
  uuid,
  index,
} from "drizzle-orm/pg-core";

/**
 * Loan schemes (seeded). Money-adjacent rates are stored as integer basis
 * points (100 bps = 1%) so nothing financial is ever a float.
 */
export const loanSchemes = pgTable("loan_schemes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  annualInterestRateBps: integer("annual_interest_rate_bps").notNull(),
  tenureMonths: integer("tenure_months").notNull(),
  maxLtvBps: integer("max_ltv_bps").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    applicationId: text("application_id").notNull().unique(),
    applicantName: text("applicant_name").notNull(),
    /** Stored raw ONLY for duplicate detection; never serialised unmasked. */
    mobile: text("mobile").notNull(),
    grossWeightMg: integer("gross_weight_mg").notNull(),
    netWeightMg: integer("net_weight_mg").notNull(),
    karat: integer("karat").notNull(),
    planId: text("plan_id")
      .notNull()
      .references(() => loanSchemes.id),
    pureGoldGrams: numeric("pure_gold_grams", { precision: 10, scale: 3 }).notNull(),
    goldValuePaise: bigint("gold_value_paise", { mode: "number" }).notNull(),
    eligibleLoanPaise: bigint("eligible_loan_paise", { mode: "number" }).notNull(),
    status: text("status").notNull().default("SUBMITTED"),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("leads_mobile_created_idx").on(table.mobile, table.createdAt),
    index("leads_plan_idx").on(table.planId),
    index("leads_idempotency_idx").on(table.idempotencyKey),
  ],
);

export type LoanSchemeRow = typeof loanSchemes.$inferSelect;
export type LeadRow = typeof leads.$inferSelect;
