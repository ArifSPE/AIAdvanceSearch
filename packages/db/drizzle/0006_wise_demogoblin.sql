CREATE TABLE "saved_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"question" text NOT NULL,
	"sql" text NOT NULL,
	"explanation" text NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"tables" jsonb NOT NULL,
	"column_types" jsonb NOT NULL,
	"output_order" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_queries" ADD CONSTRAINT "saved_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_queries_user_name_idx" ON "saved_queries" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "saved_queries_user_idx" ON "saved_queries" USING btree ("user_id");