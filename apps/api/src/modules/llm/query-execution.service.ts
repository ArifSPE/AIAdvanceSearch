import { sql, type Database } from '@ais/db'
import type { ExecuteQueryResponse, FilterValues, QueryExecutionResult } from '@ais/shared'
import { executeQueryResponseSchema } from '@ais/shared'
import { assertReadOnlySql } from './sql-validation'
import { verifyGeneratedQueryToken, type GeneratedQueryTokenPayload } from './query-token'
import { bindQueryFilters } from './query-filters'

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
  constructor(private readonly db: Database) {}

  async execute(queryToken: string, userId: string, filterValues?: FilterValues): Promise<ExecuteQueryResponse> {
    const query = await verifyGeneratedQueryToken(queryToken, userId)
    return this.run(query, queryToken, filterValues)
  }

  /** Validates and runs an already-trusted query payload read-only. */
  async run(query: GeneratedQueryTokenPayload, queryToken: string, filterValues?: FilterValues): Promise<ExecuteQueryResponse> {
    assertReadOnlySql(query.sql, query.tables)

    const querySql = query.sql.replace(/;\s*$/, '')
    const boundSql = bindQueryFilters(querySql, query.filters ?? [], filterValues)
    const cappedSql = sql`SELECT * FROM (${boundSql}) AS generated_query LIMIT ${maxRows + 1}`
    const rawRows = await this.db.transaction(async (transaction) => {
      await transaction.execute(sql`SET TRANSACTION READ ONLY`)
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
      filters: query.filters ?? [],
      result: { columns, rows, rowCount: rows.length, truncated },
    })
  }
}