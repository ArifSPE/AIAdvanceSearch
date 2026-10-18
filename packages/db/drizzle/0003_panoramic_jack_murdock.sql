CREATE TYPE "public"."loan_status" AS ENUM('active', 'delinquent', 'closed');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('paid', 'missed', 'partial', 'pending');--> statement-breakpoint
CREATE TABLE "borrowers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"legal_name" text NOT NULL,
	"business_type" text NOT NULL,
	"industry" text NOT NULL,
	"annual_revenue" numeric(14, 2) NOT NULL,
	"risk_rating" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"branch_id" uuid NOT NULL,
	"relationship_manager_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collateral" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"reference_code" text NOT NULL,
	"collateral_type" text NOT NULL,
	"description" text NOT NULL,
	"appraised_value" numeric(14, 2) NOT NULL,
	"valuation_date" date NOT NULL,
	"lien_position" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"relationship_manager_id" uuid,
	"contact_reference" text NOT NULL,
	"channel" text NOT NULL,
	"contacted_at" timestamp with time zone NOT NULL,
	"outcome" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loan_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"loan_id" uuid NOT NULL,
	"payment_reference" text NOT NULL,
	"due_date" date NOT NULL,
	"paid_date" date,
	"amount_due" numeric(12, 2) NOT NULL,
	"amount_paid" numeric(12, 2),
	"status" "payment_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"borrower_id" uuid NOT NULL,
	"loan_number" text NOT NULL,
	"product_type" text NOT NULL,
	"principal_amount" numeric(14, 2) NOT NULL,
	"outstanding_balance" numeric(14, 2) NOT NULL,
	"interest_rate" numeric(5, 2) NOT NULL,
	"status" "loan_status" DEFAULT 'active' NOT NULL,
	"origination_date" date NOT NULL,
	"maturity_date" date NOT NULL,
	"next_payment_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relationship_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"branch_id" uuid NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_relationship_manager_id_relationship_managers_id_fk" FOREIGN KEY ("relationship_manager_id") REFERENCES "public"."relationship_managers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collateral" ADD CONSTRAINT "collateral_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_relationship_manager_id_relationship_managers_id_fk" FOREIGN KEY ("relationship_manager_id") REFERENCES "public"."relationship_managers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_payments" ADD CONSTRAINT "loan_payments_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_borrowers_id_fk" FOREIGN KEY ("borrower_id") REFERENCES "public"."borrowers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relationship_managers" ADD CONSTRAINT "relationship_managers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "borrowers_external_id_unique" ON "borrowers" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "borrowers_branch_idx" ON "borrowers" USING btree ("branch_id");--> statement-breakpoint
CREATE INDEX "borrowers_relationship_manager_idx" ON "borrowers" USING btree ("relationship_manager_id");--> statement-breakpoint
CREATE INDEX "borrowers_industry_idx" ON "borrowers" USING btree ("industry");--> statement-breakpoint
CREATE UNIQUE INDEX "branches_code_unique" ON "branches" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "collateral_reference_unique" ON "collateral" USING btree ("reference_code");--> statement-breakpoint
CREATE INDEX "collateral_loan_idx" ON "collateral" USING btree ("loan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_contacts_reference_unique" ON "customer_contacts" USING btree ("contact_reference");--> statement-breakpoint
CREATE INDEX "customer_contacts_borrower_contacted_idx" ON "customer_contacts" USING btree ("borrower_id","contacted_at");--> statement-breakpoint
CREATE INDEX "customer_contacts_manager_idx" ON "customer_contacts" USING btree ("relationship_manager_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loan_payments_reference_unique" ON "loan_payments" USING btree ("payment_reference");--> statement-breakpoint
CREATE INDEX "loan_payments_loan_idx" ON "loan_payments" USING btree ("loan_id");--> statement-breakpoint
CREATE INDEX "loan_payments_due_status_idx" ON "loan_payments" USING btree ("due_date","status");--> statement-breakpoint
CREATE UNIQUE INDEX "loans_loan_number_unique" ON "loans" USING btree ("loan_number");--> statement-breakpoint
CREATE INDEX "loans_borrower_idx" ON "loans" USING btree ("borrower_id");--> statement-breakpoint
CREATE INDEX "loans_status_idx" ON "loans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "loans_maturity_date_idx" ON "loans" USING btree ("maturity_date");--> statement-breakpoint
CREATE UNIQUE INDEX "relationship_managers_email_unique" ON "relationship_managers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "relationship_managers_branch_idx" ON "relationship_managers" USING btree ("branch_id");