import { sql, type Database } from '@ais/db'
import type { ExecuteQueryResponse, FilterValues, QueryExecutionResult } from '@ais/shared'
import { executeQueryResponseSchema } from '@ais/shared'
import { assertReadOnlySql } from './sql-validation'
import { verifyGeneratedQueryToken, type GeneratedQueryTokenPayload } from './query-token'
import { bindQueryFilters } from './query-filters'
import { compileQueryPlan } from './query-plan'
import { TableMetadataService } from '../metadata/tablemetadata.service'

const maxRows = 200
const statementTimeoutMs = 5000

type ResultRow = Record<string, unknown>
type QueryRows = ResultRow[] & { columns?: Array<{ name: string; type: number }> }

const postgresTypeNames: Record<number, string> = {
  16: 'boolean',
  20: 'bigint',
  21: 'smallint',
  23: 'integer',
  25: 'text',
  700: 'real',
  701: 'double precision',
  1043: 'varchar',
  1082: 'date',
  1114: 'timestamp',
  1184: 'timestamptz',
  1700: 'numeric',
  2950: 'uuid',
  3802: 'jsonb',
}

function toJsonValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export class QueryExecutionService {
  constructor(private readonly db: Database, private readonly metadataDb?: Database) {}

  async execute(queryToken: string, userId: string, filterValues?: FilterValues): Promise<ExecuteQueryResponse> {
    const query = await verifyGeneratedQueryToken(queryToken, userId)
    return this.run(query, queryToken, userId, filterValues)
  }

  /** Validates and runs an already-trusted query payload read-only. */
  async run(query: GeneratedQueryTokenPayload, queryToken: string, userId: string, filterValues?: FilterValues): Promise<ExecuteQueryResponse> {
    if (!query.plan || !this.metadataDb) throw new Error('A validated query plan and current metadata are required; regenerate legacy drafts')
    const { tables } = await new TableMetadataService(this.metadataDb).getSchema()
    const compiled = compileQueryPlan(query.plan, tables)
    if (compiled.sql !== query.sql) throw new Error('Stored SQL does not match the validated query plan')
    assertReadOnlySql(compiled.sql, query.tables)

    const querySql = query.sql.replace(/;\s*$/, '')
    const boundSql = bindQueryFilters(querySql, compiled.filters, filterValues)
    const cappedSql = sql`SELECT * FROM (${boundSql}) AS generated_query LIMIT ${maxRows + 1}`
    const rawRows = await this.db.transaction(async (transaction) => {
      await transaction.execute(sql`SET TRANSACTION READ ONLY`)
      const roleRows = await transaction.execute(sql`SELECT role_info.rolsuper OR role_info.rolbypassrls OR EXISTS (
        SELECT 1 FROM pg_catalog.pg_class table_info JOIN pg_catalog.pg_namespace namespace_info ON namespace_info.oid = table_info.relnamespace
        WHERE namespace_info.nspname = 'public' AND table_info.relname IN ('branches', 'relationship_managers', 'borrowers', 'loans', 'loan_payments', 'collateral', 'customer_contacts', 'user_branch_access')
          AND (table_info.relowner = role_info.oid OR NOT table_info.relrowsecurity OR NOT table_info.relforcerowsecurity)
      ) AS unsafe FROM pg_catalog.pg_roles role_info WHERE role_info.rolname = current_user`)
      if ((roleRows as unknown as Array<{ unsafe: boolean }>)[0]?.unsafe !== false) throw new Error('Query execution requires a non-owner, non-superuser role without BYPASSRLS and enforced RLS on lending tables')
      await transaction.execute(sql`SELECT set_config('app.user_id', ${userId}, true)`)
      await transaction.execute(
        sql`SELECT set_config('statement_timeout', ${`${statementTimeoutMs}ms`}, true)`,
      )
      await transaction.execute(sql`SET LOCAL search_path TO public`)
      return transaction.execute(cappedSql)
    })

    const queryRows = rawRows as unknown as QueryRows
    const resultRows = Array.from(queryRows)
    const truncated = resultRows.length > maxRows
    const rows = toJsonValue(resultRows.slice(0, maxRows))
    const selectedTypesByName = new Map(
      Object.entries(query.columnTypes).map(([qualifiedName, type]) => [
        qualifiedName.split('.').at(-1)!,
        type,
      ]),
    )
    const columns: QueryExecutionResult['columns'] = queryRows.columns
      ? queryRows.columns.map((column) => ({
          name: column.name,
          type: postgresTypeNames[column.type] ?? selectedTypesByName.get(column.name) ?? 'unknown',
        }))
      : Object.keys(rows[0] ?? {}).map((name) => ({ name, type: 'unknown' }))

    return executeQueryResponseSchema.parse({
      sql: query.sql,
      explanation: query.explanation,
      provider: query.provider,
      model: query.model,
      queryToken,
      filters: compiled.filters,
      plan: compiled.plan,
      result: { columns, rows, rowCount: rows.length, truncated },
    })
  }
}