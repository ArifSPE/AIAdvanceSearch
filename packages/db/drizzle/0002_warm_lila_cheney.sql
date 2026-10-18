ALTER TABLE "column_metadata" ADD COLUMN "parent_table" text;--> statement-breakpoint
ALTER TABLE "column_metadata" ADD CONSTRAINT "column_metadata_table_id_table_metadata_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."table_metadata"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "column_metadata_name_idx" ON "column_metadata" USING btree ("name");--> statement-breakpoint
CREATE INDEX "column_metadata_table_id_idx" ON "column_metadata" USING btree ("table_id");