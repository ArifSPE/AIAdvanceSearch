CREATE TYPE "public"."user_role" AS ENUM('User', 'IT-Admin');--> statement-breakpoint
CREATE TYPE "public"."llm_provider_kind" AS ENUM('ollama', 'openai', 'anthropic', 'bedrock');--> statement-breakpoint
CREATE TABLE "curated_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"category" text NOT NULL,
	"question" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "llm_provider_settings" (
	"provider" "llm_provider_kind" PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"model" text NOT NULL,
	"fallback_model" text,
	"models" text[] NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"aws_region" text,
	"aws_profile" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'User' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "llm_provider_settings_one_default_idx" ON "llm_provider_settings" USING btree ("is_default") WHERE "llm_provider_settings"."is_default" = true;--> statement-breakpoint
INSERT INTO "curated_prompts" ("label", "category", "question", "sort_order") VALUES
('High-balance active loans', 'Loans and payments', 'Find active loans with an outstanding balance above $500,000. Show the loan number, borrower legal name, outstanding balance, and maturity date.', 10),
('Loans approaching maturity', 'Loans and payments', 'Find loans maturing in the next 90 days. Show the loan number, borrower legal name, maturity date, and outstanding balance, with the earliest maturity first.', 20),
('Missed loan payments', 'Loans and payments', 'Which borrowers have missed loan payments, and which branch handles them? Show the borrower legal name, branch name, loan number, payment due date, amount due, and amount paid.', 30),
('Payment history for a loan', 'Loans and payments', 'Show the payment history for loan LN-1001. Include the payment reference, due date, amount due, amount paid, and payment status, ordered by due date.', 40),
('Borrower relationship directory', 'Borrowers and portfolios', 'List borrowers with their branch and relationship manager. Show the borrower legal name, industry, risk rating, branch name, and relationship manager name.', 50),
('Branch lending exposure', 'Borrowers and portfolios', 'What is the total outstanding loan balance for each branch? Show the branch name and total outstanding balance, with the largest total first.', 60),
('Borrower loan balances', 'Borrowers and portfolios', 'Show borrowers and their loans. Include the borrower legal name, risk rating, loan number, product type, outstanding balance, and loan status, ordered by outstanding balance from largest to smallest.', 70),
('Collateral against loan balances', 'Collateral and customer activity', 'Show loans and their pledged collateral. Include the borrower legal name, loan number, outstanding loan balance, collateral asset type, and appraised value.', 80),
('Recent customer contacts', 'Collateral and customer activity', 'Show customer contacts from the last 30 days. Include the borrower legal name, relationship manager name, contact date, and outcome, with the most recent contacts first.', 90);