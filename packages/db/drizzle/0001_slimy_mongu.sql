CREATE TABLE "column_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"column_data_type" text NOT NULL,
	"is_nullable" boolean NOT NULL,
	"default_value" text NOT NULL,
	"character_maximum_length" integer NOT NULL,
	"numeric_precision" integer NOT NULL,
	"numeric_scale" integer NOT NULL,
	"is_primary_key" boolean NOT NULL,
	"is_foreign_key" boolean NOT NULL,
	"is_unique" boolean NOT NULL,
	"is_indexed" boolean NOT NULL,
	"table_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "table_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"description" text NOT NULL,
	"is_active" boolean NOT NULL,
	"is_parent" boolean NOT NULL,
	"is_parent_id" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "table_metadata_name_idx" ON "table_metadata" USING btree ("name");