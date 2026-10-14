CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" text NOT NULL,
	"applicant_name" text NOT NULL,
	"mobile" text NOT NULL,
	"gross_weight_mg" integer NOT NULL,
	"net_weight_mg" integer NOT NULL,
	"karat" integer NOT NULL,
	"plan_id" text NOT NULL,
	"pure_gold_grams" numeric(10, 3) NOT NULL,
	"gold_value_paise" bigint NOT NULL,
	"eligible_loan_paise" bigint NOT NULL,
	"status" text DEFAULT 'SUBMITTED' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "loan_schemes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"annual_interest_rate_bps" integer NOT NULL,
	"tenure_months" integer NOT NULL,
	"max_ltv_bps" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_plan_id_loan_schemes_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."loan_schemes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leads_mobile_created_idx" ON "leads" USING btree ("mobile","created_at");--> statement-breakpoint
CREATE INDEX "leads_plan_idx" ON "leads" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "leads_idempotency_idx" ON "leads" USING btree ("idempotency_key");