import { relations } from 'drizzle-orm'
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

export interface SavedQueryTable {
  name: string
  columns: string[]
}

/** A generated SQL query a user saved to run again. */
export const savedQueries = pgTable(
  'saved_queries',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    question: text().notNull(),
    sql: text().notNull(),
    explanation: text().notNull(),
    provider: text().notNull(),
    model: text().notNull(),
    /** Tables and columns the SQL may reference, re-checked against metadata on every run. */
    tables: jsonb().$type<SavedQueryTable[]>().notNull(),
    columnTypes: jsonb().$type<Record<string, string>>().notNull(),
    /** `table.column` display order, used to restore the selection in the editor. */
    outputOrder: jsonb().$type<string[]>().notNull().default([]),
    filters: jsonb().$type<unknown[]>().notNull().default([]),
    lastRunAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('saved_queries_user_name_idx').on(table.userId, table.name),
    index('saved_queries_user_idx').on(table.userId),
  ],
)

export const savedQueriesRelations = relations(savedQueries, ({ one }) => ({
  user: one(users, { fields: [savedQueries.userId], references: [users.id] }),
}))

export type SavedQueryRow = typeof savedQueries.$inferSelect
export type NewSavedQueryRow = typeof savedQueries.$inferInsert
