import { branches, borrowers, collateral, createAppDatabase, createMetadataDatabase, createQueryDatabase, customerContacts, eq, inArray, loanPayments, loans, relationshipManagers, sql, userBranchAccess, users } from '@ais/db'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { QueryExecutionService } from '../src/modules/llm/query-execution.service'
import { createGeneratedQueryToken } from '../src/modules/llm/query-token'
import { compileQueryPlan } from '../src/modules/llm/query-plan'
import { TableMetadataService } from '../src/modules/metadata/tablemetadata.service'
import type { MetadataTableWithColumns, QueryPlan } from '@ais/shared'

describe.skipIf(process.env.RUN_DB_INTEGRATION_TESTS !== 'true')('PostgreSQL row entitlements', () => {
  const userIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
  const branchIds = [crypto.randomUUID(), crypto.randomUUID()]
  const managerIds = [crypto.randomUUID(), crypto.randomUUID()]
  const borrowerIds = [crypto.randomUUID(), crypto.randomUUID()]
  const loanIds = [crypto.randomUUID(), crypto.randomUUID()]
  const prefix = `rls-${crypto.randomUUID().slice(0, 8)}`
  let appDb: ReturnType<typeof createAppDatabase>
  let queryDb: ReturnType<typeof createQueryDatabase>
  let metadataDb: ReturnType<typeof createMetadataDatabase>
  let catalog: MetadataTableWithColumns[]
  let executor: QueryExecutionService

  beforeAll(async () => {
    const { env } = await import('../src/config/env')
    if (!env.QUERY_DB_URL) throw new Error('QUERY_DB_URL required')
    appDb = createAppDatabase({ max: 1 }); queryDb = createQueryDatabase({ max: 1 }); metadataDb = createMetadataDatabase({ max: 1 })
    executor = new QueryExecutionService(queryDb.db, metadataDb.db)
    catalog = (await new TableMetadataService(metadataDb.db).getSchema()).tables
    await appDb.db.insert(users).values(userIds.map((id, index) => ({ id, email: `${prefix}-${index}@example.test`, role: index === 2 ? 'IT-Admin' as const : 'User' as const })))
    await appDb.db.insert(branches).values(branchIds.map((id, index) => ({ id, code: `${prefix}-${index}`, name: `${prefix} branch ${index}`, region: 'Test', city: 'Test', state: 'TS' })))
    await appDb.db.insert(relationshipManagers).values(managerIds.map((id, index) => ({ id, firstName: 'Test', lastName: String(index), email: `${prefix}-manager-${index}@example.test`, branchId: branchIds[index]!, isActive: true })))
    await appDb.db.insert(borrowers).values(borrowerIds.map((id, index) => ({ id, externalId: `${prefix}-${index}`, legalName: `${prefix} borrower ${index}`, businessType: 'Test', industry: 'Test', annualRevenue: '1000', riskRating: 'Low', branchId: branchIds[index]!, relationshipManagerId: managerIds[index]! })))
    await appDb.db.insert(loans).values(loanIds.map((id, index) => ({ id, borrowerId: borrowerIds[index]!, loanNumber: `${prefix}-loan-${index}`, productType: 'Test', principalAmount: '1000', outstandingBalance: String(100 + index), interestRate: '5', status: 'active' as const, originationDate: '2026-01-01', maturityDate: '2027-01-01' })))
    await appDb.db.insert(loanPayments).values(loanIds.map((id, index) => ({ loanId: id, paymentReference: `${prefix}-payment-${index}`, dueDate: '2026-02-01', amountDue: '10', status: 'missed' as const })))
    await appDb.db.insert(collateral).values(loanIds.map((id, index) => ({ loanId: id, referenceCode: `${prefix}-asset-${index}`, collateralType: 'Test', description: 'Synthetic fixture', appraisedValue: '1000', valuationDate: '2026-01-01', isActive: true })))
    await appDb.db.insert(customerContacts).values(borrowerIds.map((id, index) => ({ borrowerId: id, relationshipManagerId: managerIds[index]!, contactReference: `${prefix}-contact-${index}`, channel: 'Test', contactedAt: new Date('2026-01-01T00:00:00Z'), outcome: 'Test' })))
    await appDb.db.insert(userBranchAccess).values(branchIds.map((branchId, index) => ({ userId: userIds[index]!, branchId })))
  })

  afterAll(async () => {
    try {
      if (appDb) {
        await appDb.db.delete(users).where(inArray(users.id, userIds))
        await appDb.db.delete(customerContacts).where(inArray(customerContacts.borrowerId, borrowerIds))
        await appDb.db.delete(loans).where(inArray(loans.id, loanIds))
        await appDb.db.delete(borrowers).where(inArray(borrowers.id, borrowerIds))
        await appDb.db.delete(relationshipManagers).where(inArray(relationshipManagers.id, managerIds))
        await appDb.db.delete(branches).where(inArray(branches.id, branchIds))
      }
    } finally { await Promise.all([appDb?.close(), queryDb?.close(), metadataDb?.close()]) }
  })

  async function run(table: string, column: string, userId: string) {
    const plan: QueryPlan = { version: 1, tables: [table], projections: [{ column: `${table}.${column}`, aggregate: 'none' }], joins: [], filters: [], groupBy: [], orderBy: [] }
    const compiled = compileQueryPlan(plan, catalog)
    const token = await createGeneratedQueryToken(userId, { sql: compiled.sql, explanation: 'RLS verification', provider: 'ollama', model: 'fixture', plan, filters: [], tables: [{ name: table, columns: [column] }], columnTypes: {} })
    return executor.execute(token, userId)
  }

  it('isolates both users across all seven lending tables', async () => {
    for (const [table, column, expected] of [
      ['branches', 'id', branchIds], ['relationship_managers', 'id', managerIds], ['borrowers', 'id', borrowerIds], ['loans', 'id', loanIds],
      ['loan_payments', 'loan_id', loanIds], ['collateral', 'loan_id', loanIds], ['customer_contacts', 'borrower_id', borrowerIds],
    ] as const) {
      for (const index of [0, 1]) {
        const response = await run(table, column, userIds[index]!)
        expect(response.result.rows).toEqual([{ [column]: expected[index] }])
      }
    }
  })

  it('defaults to no rows without grants, including an IT-Admin', async () => {
    expect((await run('loans', 'id', userIds[2]!)).result.rows).toEqual([])
  })

  it('does not leak identity across reused pool connections or failures', async () => {
    await run('loans', 'id', userIds[0]!)
    const direct = await queryDb.sql`SELECT id FROM loans`
    expect(direct).toHaveLength(0)
    await expect(queryDb.sql.begin(async (transaction) => {
      await transaction`SELECT set_config('app.user_id', ${userIds[0]!}, true)`
      await transaction.unsafe('SELECT 1/0')
    })).rejects.toThrow()
    expect(await queryDb.sql`SELECT id FROM loans`).toHaveLength(0)
    const results = await Promise.all([run('loans', 'id', userIds[0]!), run('loans', 'id', userIds[1]!)])
    expect(results[0]!.result.rows).toEqual([{ id: loanIds[0] }])
    expect(results[1]!.result.rows).toEqual([{ id: loanIds[1] }])
  })

  it('applies grant revocation on the next execution', async () => {
    await appDb.db.delete(userBranchAccess).where(eq(userBranchAccess.userId, userIds[1]!))
    expect((await run('loans', 'id', userIds[1]!)).result.rows).toEqual([])
  })

  it('rejects privileged execution connections and SQL-only tokens', async () => {
    const plan: QueryPlan = { version: 1, tables: ['loans'], projections: [{ column: 'loans.id', aggregate: 'none' }], joins: [], filters: [], groupBy: [], orderBy: [] }
    const compiled = compileQueryPlan(plan, catalog)
    const payload = { sql: compiled.sql, explanation: 'Test', provider: 'ollama' as const, model: 'fixture', tables: [{ name: 'loans', columns: ['id'] }], columnTypes: {} }
    const legacy = await createGeneratedQueryToken(userIds[0]!, payload)
    await expect(executor.execute(legacy, userIds[0]!)).rejects.toThrow('validated query plan')
    const token = await createGeneratedQueryToken(userIds[0]!, { ...payload, plan })
    await expect(new QueryExecutionService(appDb.db, metadataDb.db).execute(token, userIds[0]!)).rejects.toThrow('BYPASSRLS')
  })
})