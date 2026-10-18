ALTER TABLE "column_metadata" ADD COLUMN "allowed_values" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE "column_metadata" AS column_info
SET "allowed_values" = enum_info.allowed_values
FROM (
	SELECT type_info.typname AS type_name, array_agg(enum_value.enumlabel::text ORDER BY enum_value.enumsortorder) AS allowed_values
	FROM pg_catalog.pg_type AS type_info
	JOIN pg_catalog.pg_enum AS enum_value ON enum_value.enumtypid = type_info.oid
	JOIN pg_catalog.pg_namespace AS namespace_info ON namespace_info.oid = type_info.typnamespace
	WHERE namespace_info.nspname = 'public'
	GROUP BY type_info.typname
) AS enum_info
WHERE column_info.column_data_type = enum_info.type_name;