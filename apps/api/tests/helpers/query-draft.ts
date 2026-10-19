import { branches, userBranchAccess, type Database } from '@ais/db'
import type { QueryFilter, QueryPlan } from '@ais/shared'
import { compileQueryPlan } from '../../src/modules/llm/query-plan'
import { createGeneratedQueryToken } from '../../src/modules/llm/query-token'
import { TableMetadataService } from '../../src/modules/metadata/tablemetadata.service'

export async function grantFixtureBranches(db: Database, userId: string) {
  const rows = await db.select({ id: branches.id }).from(branches)
  if (rows.length) await db.insert(userBranchAccess).values(rows.map((branch) => ({ userId, branchId: branch.id }))).onConflictDoNothing()
}

export async function loanDraft(metadataDb: Database, userId: string, input: { columns: string[]; filters?: QueryFilter[]; order?: 'asc' | 'desc'; question: string }) {
  const { tables } = await new TableMetadataService(metadataDb).getSchema()
  const plan: QueryPlan = { version: 1, tables: ['loans'], projections: input.columns.map((column) => ({ column: `loans.${column}`, aggregate: 'none' })), joins: [], filters: (input.filters ?? []).map(({ id, table, column, operator, defaultValue }) => ({ id, table, column, operator, defaultValue })), groupBy: [], orderBy: input.order ? [{ projection: 0, direction: input.order }] : [] }
  const compiled = compileQueryPlan(plan, tables)
  const columns = [...new Set([...input.columns, ...(input.filters ?? []).map((filter) => filter.column)])]
  const token = await createGeneratedQueryToken(userId, { sql: compiled.sql, explanation: 'Canonical fixture query', question: input.question, provider: 'ollama', model: 'test-model', plan: compiled.plan, filters: compiled.filters, tables: [{ name: 'loans', columns }], columnTypes: {} })
  return { token, sql: compiled.sql, plan: compiled.plan }
}