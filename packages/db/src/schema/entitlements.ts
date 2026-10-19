import { pgTable, primaryKey, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users'
import { branches } from './lending'

export const userBranchAccess = pgTable('user_branch_access', {
  userId: uuid().notNull().references(() => users.id, { onDelete: 'cascade' }),
  branchId: uuid().notNull().references(() => branches.id, { onDelete: 'cascade' }),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.branchId] })]).enableRLS()