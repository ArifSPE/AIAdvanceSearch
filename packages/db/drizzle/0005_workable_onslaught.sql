ALTER TABLE "column_metadata" ADD COLUMN "display_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "table_metadata" ADD COLUMN "display_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "table_metadata" SET "display_name" = regexp_replace(initcap(replace("name", '_', ' ')), '\mId\M', 'ID', 'g') WHERE "display_name" = '';--> statement-breakpoint
UPDATE "column_metadata" SET "display_name" = regexp_replace(initcap(replace("name", '_', ' ')), '\mId\M', 'ID', 'g') WHERE "display_name" = '';