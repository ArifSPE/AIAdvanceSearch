import { relations } from 'drizzle-orm'
import { index, integer, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'

/** Query log — powers analytics, autocomplete and relevance tuning. */
export const searchQueries = pgTable(
  'search_queries',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid().references(() => users.id, { onDelete: 'set null' }),
    query: text().notNull(),
    resultCount: integer().notNull().default(0),
    tookMs: real().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('search_queries_created_at_idx').on(table.createdAt),
    index('search_queries_user_idx').on(table.userId),
  ],
)

export const searchQueriesRelations = relations(searchQueries, ({ one }) => ({
  user: one(users, { fields: [searchQueries.userId], references: [users.id] }),
}))

export type SearchQueryRow = typeof searchQueries.$inferSelect
export type NewSearchQueryRow = typeof searchQueries.$inferInsert
