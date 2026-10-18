import { relations } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const loanStatus = pgEnum('loan_status', ['active', 'delinquent', 'closed'])
export const paymentStatus = pgEnum('payment_status', ['paid', 'missed', 'partial', 'pending'])

export const branches = pgTable(
  'branches',
  {
    id: uuid().primaryKey().defaultRandom(),
    code: text().notNull(),
    name: text().notNull(),
    region: text().notNull(),
    city: text().notNull(),
    state: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('branches_code_unique').on(table.code)],
)

export const relationshipManagers = pgTable(
  'relationship_managers',
  {
    id: uuid().primaryKey().defaultRandom(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    email: text().notNull(),
    branchId: uuid()
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('relationship_managers_email_unique').on(table.email),
    index('relationship_managers_branch_idx').on(table.branchId),
  ],
)

export const borrowers = pgTable(
  'borrowers',
  {
    id: uuid().primaryKey().defaultRandom(),
    externalId: text().notNull(),
    legalName: text().notNull(),
    businessType: text().notNull(),
    industry: text().notNull(),
    annualRevenue: numeric({ precision: 14, scale: 2 }).notNull(),
    riskRating: text().notNull(),
    status: text().notNull().default('active'),
    branchId: uuid()
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    relationshipManagerId: uuid()
      .notNull()
      .references(() => relationshipManagers.id, { onDelete: 'restrict' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('borrowers_external_id_unique').on(table.externalId),
    index('borrowers_branch_idx').on(table.branchId),
    index('borrowers_relationship_manager_idx').on(table.relationshipManagerId),
    index('borrowers_industry_idx').on(table.industry),
  ],
)

export const loans = pgTable(
  'loans',
  {
    id: uuid().primaryKey().defaultRandom(),
    borrowerId: uuid()
      .notNull()
      .references(() => borrowers.id, { onDelete: 'restrict' }),
    loanNumber: text().notNull(),
    productType: text().notNull(),
    principalAmount: numeric({ precision: 14, scale: 2 }).notNull(),
    outstandingBalance: numeric({ precision: 14, scale: 2 }).notNull(),
    interestRate: numeric({ precision: 5, scale: 2 }).notNull(),
    status: loanStatus().notNull().default('active'),
    originationDate: date().notNull(),
    maturityDate: date().notNull(),
    nextPaymentDate: date(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('loans_loan_number_unique').on(table.loanNumber),
    index('loans_borrower_idx').on(table.borrowerId),
    index('loans_status_idx').on(table.status),
    index('loans_maturity_date_idx').on(table.maturityDate),
  ],
)

export const loanPayments = pgTable(
  'loan_payments',
  {
    id: uuid().primaryKey().defaultRandom(),
    loanId: uuid()
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    paymentReference: text().notNull(),
    dueDate: date().notNull(),
    paidDate: date(),
    amountDue: numeric({ precision: 12, scale: 2 }).notNull(),
    amountPaid: numeric({ precision: 12, scale: 2 }),
    status: paymentStatus().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('loan_payments_reference_unique').on(table.paymentReference),
    index('loan_payments_loan_idx').on(table.loanId),
    index('loan_payments_due_status_idx').on(table.dueDate, table.status),
  ],
)

export const collateral = pgTable(
  'collateral',
  {
    id: uuid().primaryKey().defaultRandom(),
    loanId: uuid()
      .notNull()
      .references(() => loans.id, { onDelete: 'cascade' }),
    referenceCode: text().notNull(),
    collateralType: text().notNull(),
    description: text().notNull(),
    appraisedValue: numeric({ precision: 14, scale: 2 }).notNull(),
    valuationDate: date().notNull(),
    lienPosition: integer().notNull().default(1),
    isActive: boolean().notNull().default(true),
  },
  (table) => [
    uniqueIndex('collateral_reference_unique').on(table.referenceCode),
    index('collateral_loan_idx').on(table.loanId),
  ],
)

export const customerContacts = pgTable(
  'customer_contacts',
  {
    id: uuid().primaryKey().defaultRandom(),
    borrowerId: uuid()
      .notNull()
      .references(() => borrowers.id, { onDelete: 'cascade' }),
    relationshipManagerId: uuid().references(() => relationshipManagers.id, {
      onDelete: 'set null',
    }),
    contactReference: text().notNull(),
    channel: text().notNull(),
    contactedAt: timestamp({ withTimezone: true }).notNull(),
    outcome: text().notNull(),
    notes: text().notNull().default(''),
  },
  (table) => [
    uniqueIndex('customer_contacts_reference_unique').on(table.contactReference),
    index('customer_contacts_borrower_contacted_idx').on(table.borrowerId, table.contactedAt),
    index('customer_contacts_manager_idx').on(table.relationshipManagerId),
  ],
)

export const branchesRelations = relations(branches, ({ many }) => ({
  relationshipManagers: many(relationshipManagers),
  borrowers: many(borrowers),
}))

export const relationshipManagersRelations = relations(relationshipManagers, ({ one, many }) => ({
  branch: one(branches, {
    fields: [relationshipManagers.branchId],
    references: [branches.id],
  }),
  borrowers: many(borrowers),
  customerContacts: many(customerContacts),
}))

export const borrowersRelations = relations(borrowers, ({ one, many }) => ({
  branch: one(branches, { fields: [borrowers.branchId], references: [branches.id] }),
  relationshipManager: one(relationshipManagers, {
    fields: [borrowers.relationshipManagerId],
    references: [relationshipManagers.id],
  }),
  loans: many(loans),
  customerContacts: many(customerContacts),
}))

export const loansRelations = relations(loans, ({ one, many }) => ({
  borrower: one(borrowers, { fields: [loans.borrowerId], references: [borrowers.id] }),
  payments: many(loanPayments),
  collateral: many(collateral),
}))

export const loanPaymentsRelations = relations(loanPayments, ({ one }) => ({
  loan: one(loans, { fields: [loanPayments.loanId], references: [loans.id] }),
}))

export const collateralRelations = relations(collateral, ({ one }) => ({
  loan: one(loans, { fields: [collateral.loanId], references: [loans.id] }),
}))

export const customerContactsRelations = relations(customerContacts, ({ one }) => ({
  borrower: one(borrowers, { fields: [customerContacts.borrowerId], references: [borrowers.id] }),
  relationshipManager: one(relationshipManagers, {
    fields: [customerContacts.relationshipManagerId],
    references: [relationshipManagers.id],
  }),
}))

export type Branch = typeof branches.$inferSelect
export type RelationshipManager = typeof relationshipManagers.$inferSelect
export type Borrower = typeof borrowers.$inferSelect
export type Loan = typeof loans.$inferSelect
export type LoanPayment = typeof loanPayments.$inferSelect
export type Collateral = typeof collateral.$inferSelect
export type CustomerContact = typeof customerContacts.$inferSelect