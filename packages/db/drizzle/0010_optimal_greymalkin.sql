CREATE TABLE "user_branch_access" (
	"user_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_branch_access_user_id_branch_id_pk" PRIMARY KEY("user_id","branch_id")
);
--> statement-breakpoint
ALTER TABLE "user_branch_access" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "borrowers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "branches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collateral" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loan_payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loans" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "relationship_managers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saved_queries" ADD COLUMN "plan" jsonb;--> statement-breakpoint
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_access" ADD CONSTRAINT "user_branch_access_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_branch_access" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "branches" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "relationship_managers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "borrowers" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loans" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "loan_payments" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "collateral" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_contacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "user_branch_access_identity" ON "user_branch_access" FOR SELECT
USING (user_id = NULLIF(current_setting('app.user_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "branches_entitlement" ON "branches" FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_branch_access AS access WHERE access.branch_id = branches.id));--> statement-breakpoint
CREATE POLICY "relationship_managers_entitlement" ON "relationship_managers" FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_branch_access AS access WHERE access.branch_id = relationship_managers.branch_id));--> statement-breakpoint
CREATE POLICY "borrowers_entitlement" ON "borrowers" FOR SELECT
USING (EXISTS (SELECT 1 FROM public.user_branch_access AS access WHERE access.branch_id = borrowers.branch_id));--> statement-breakpoint
CREATE POLICY "loans_entitlement" ON "loans" FOR SELECT
USING (EXISTS (SELECT 1 FROM public.borrowers WHERE borrowers.id = loans.borrower_id));--> statement-breakpoint
CREATE POLICY "loan_payments_entitlement" ON "loan_payments" FOR SELECT
USING (EXISTS (SELECT 1 FROM public.loans WHERE loans.id = loan_payments.loan_id));--> statement-breakpoint
CREATE POLICY "collateral_entitlement" ON "collateral" FOR SELECT
USING (EXISTS (SELECT 1 FROM public.loans WHERE loans.id = collateral.loan_id));--> statement-breakpoint
CREATE POLICY "customer_contacts_entitlement" ON "customer_contacts" FOR SELECT
USING (EXISTS (SELECT 1 FROM public.borrowers WHERE borrowers.id = customer_contacts.borrower_id));