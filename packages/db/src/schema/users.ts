import { relations } from 'drizzle-orm'
import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { documents } from './documents'

export const userRole = pgEnum('user_role', ['User', 'IT-Admin'])

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  email: text().notNull().unique(),
  passwordHash: text(),
  name: text(),
  role: userRole().notNull().default('User'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
})

export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
}))

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
