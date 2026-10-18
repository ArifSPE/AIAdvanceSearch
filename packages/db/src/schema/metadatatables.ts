import { table } from 'console';
import { relations , sql } from 'drizzle-orm';
import { index, pgTable } from 'drizzle-orm/pg-core';
import { integer, text, timestamp, boolean, uuid, uniqueIndex } from 'drizzle-orm/pg-core';




export const TableMetadata = pgTable(
    'table_metadata',
    {
        id: uuid().primaryKey().defaultRandom() ,
        name: text().notNull(),
        display_name: text().notNull().default(''),
        created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
        description: text().notNull(),
        is_active: boolean().notNull(),
        is_parent: boolean().notNull(),
        is_parentId: integer().notNull()
   },
   (table) => [
       index('table_metadata_name_idx').on(table.name)
   ]
)


export const ColumnMetadata = pgTable(
    'column_metadata',
    {
        id: uuid().primaryKey().defaultRandom(),
        name: text().notNull(),
        display_name: text().notNull().default(''),
        column_data_type: text().notNull(),
        is_nullable: boolean().notNull(),
        default_value: text().notNull(),
        character_maximum_length: integer().notNull(),
        numeric_precision: integer().notNull(),
        numeric_scale: integer().notNull(),
        is_primary_key: boolean().notNull(),
        is_foreign_key: boolean().notNull(),
        is_unique: boolean().notNull(),
        is_indexed: boolean().notNull(),
        parent_table: text(),
        table_id: uuid().notNull().references(() => TableMetadata.id, {onDelete: 'cascade'  }) ,
        created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
        updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
        description: text().notNull(),
        is_active: boolean().notNull()
    },
    (table) => [
        index('column_metadata_name_idx').on(table.name),
        index('column_metadata_table_id_idx').on(table.table_id)
    ]
);

export type TableMetadata = typeof TableMetadata.$inferInsert;  
export type ColumnMetadata = typeof ColumnMetadata.$inferInsert;
