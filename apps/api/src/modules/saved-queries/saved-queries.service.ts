import { and, desc, eq, savedQueries, type Database, type SavedQueryRow } from '@ais/db'
import { defineQueryFilter, llmProviderSchema, queryFilterSchema, queryPlanSchema, type FilterValues, type ExecuteQueryResponse, type SaveQueryInput, type SavedQuery, type UpdateSavedQueryInput } from '@ais/shared'
import { QueryExecutionService } from '../llm/query-execution.service'
import { createGeneratedQueryToken, verifyGeneratedQueryToken, InvalidGeneratedQueryTokenError } from '../llm/query-token'
import { TableMetadataService } from '../metadata/tablemetadata.service'
import { withFilterDefaults } from '../llm/query-filters'

const maxListed = 200

export class SavedQueryNotFoundError extends Error {
  constructor() {
    super('Saved query not found')
    this.name = 'SavedQueryNotFoundError'
  }
}

export class SavedQueryNameTakenError extends Error {
  constructor() {
    super('A saved query with this name already exists')
    this.name = 'SavedQueryNameTakenError'
  }
}

export class SavedQueryOutdatedError extends Error {
  constructor(reference: string) {
    super(`Saved query references an unavailable table or column: ${reference}`)
    this.name = 'SavedQueryOutdatedError'
  }
}

function isUniqueViolation(error: unknown): boolean {
  const candidates = [error, (error as { cause?: unknown } | null)?.cause]
  return candidates.some((candidate) => (candidate as { code?: unknown } | null)?.code === '23505')
}

function toSavedQuery(row: SavedQueryRow): SavedQuery {
  return {
    id: row.id,
    name: row.name,
    question: row.question,
    sql: row.sql,
    explanation: row.explanation,
    provider: llmProviderSchema.parse(row.provider),
    model: row.model,
    tableNames: row.tables.map((table) => table.name),
    outputOrder: row.outputOrder,
    filters: queryFilterSchema.array().parse(row.filters ?? []),
    plan: row.plan ? queryPlanSchema.parse(row.plan) : null,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  }
}

export class SavedQueriesService {
  constructor(
    private readonly db: Database,
    private readonly metadataDb: Database,
    private readonly queryDb: Database,
  ) {}

  async list(userId: string): Promise<SavedQuery[]> {
    const rows = await this.db
      .select()
      .from(savedQueries)
      .where(eq(savedQueries.userId, userId))
      .orderBy(desc(savedQueries.updatedAt))
      .limit(maxListed)
    return rows.map(toSavedQuery)
  }

  /** Stores a signed draft; throws InvalidGeneratedQueryTokenError if it is forged or expired. */
  async save(userId: string, input: SaveQueryInput): Promise<SavedQuery> {
    const draft = await verifyGeneratedQueryToken(input.queryToken, userId)
    if (!draft.plan) throw new InvalidGeneratedQueryTokenError()
    try {
      const [row] = await this.db
        .insert(savedQueries)
        .values({
          userId,
          name: input.name,
          question: draft.question ?? '',
          sql: draft.sql,
          explanation: draft.explanation,
          provider: draft.provider,
          model: draft.model,
          tables: draft.tables,
          columnTypes: draft.columnTypes,
          outputOrder: input.outputOrder,
          filters: withFilterDefaults(draft.filters ?? [], input.filterValues),
          plan: { ...draft.plan, filters: withFilterDefaults(draft.filters ?? [], input.filterValues).map(({ id, table, column, operator, defaultValue }) => ({ id, table, column, operator, defaultValue })) },
        })
        .returning()
      return toSavedQuery(row!)
    } catch (error) {
      if (isUniqueViolation(error)) throw new SavedQueryNameTakenError()
      throw error
    }
  }

  async run(userId: string, id: string, filterValues?: FilterValues): Promise<ExecuteQueryResponse> {
    const [row] = await this.db
      .select()
      .from(savedQueries)
      .where(and(eq(savedQueries.id, id), eq(savedQueries.userId, userId)))
      .limit(1)
    if (!row) throw new SavedQueryNotFoundError()
    if (!row.plan) throw new SavedQueryOutdatedError('legacy SQL draft; regenerate as a validated query plan')

    // Deactivating a table or column in metadata also revokes saved queries that use it.
    const { tables: activeTables } = await new TableMetadataService(this.metadataDb).getSchema()
    for (const table of row.tables) {
      const active = activeTables.find((candidate) => candidate.name === table.name)
      if (!active) throw new SavedQueryOutdatedError(table.name)
      const missing = table.columns.find((column) => !active.columns.some((candidate) => candidate.name === column))
      if (missing) throw new SavedQueryOutdatedError(`${table.name}.${missing}`)
    }

    const filters = queryFilterSchema.array().parse(row.filters ?? []).map((filter) => {
      const table = activeTables.find((candidate) => candidate.name === filter.table)
      const column = table?.columns.find((candidate) => candidate.name === filter.column)
      if (!table || !column || column.column_data_type !== filter.dataType) throw new SavedQueryOutdatedError(`${filter.table}.${filter.column}`)
      try { return defineQueryFilter(filter, column, table.display_name) }
      catch { throw new SavedQueryOutdatedError(`${filter.table}.${filter.column}`) }
    })
    const payload = {
      sql: row.sql,
      explanation: row.explanation,
      question: row.question,
      provider: llmProviderSchema.parse(row.provider),
      model: row.model,
      tables: row.tables,
      columnTypes: row.columnTypes,
      filters,
      plan: queryPlanSchema.parse(row.plan),
    }
    const queryToken = await createGeneratedQueryToken(userId, payload)
    const response = await new QueryExecutionService(this.queryDb, this.metadataDb).run(payload, queryToken, userId, filterValues)

    await this.db.update(savedQueries).set({ lastRunAt: new Date() }).where(eq(savedQueries.id, row.id))
    return response
  }

  async update(userId: string, input: UpdateSavedQueryInput): Promise<SavedQuery> {
    const [existing] = await this.db.select().from(savedQueries)
      .where(and(eq(savedQueries.id, input.id), eq(savedQueries.userId, userId))).limit(1)
    if (!existing) throw new SavedQueryNotFoundError()
    const draft = input.queryToken ? await verifyGeneratedQueryToken(input.queryToken, userId) : undefined
    if (draft && !draft.plan) throw new InvalidGeneratedQueryTokenError()
    try {
      const [row] = await this.db.update(savedQueries).set({
        name: input.name,
        ...(draft ? {
          question: draft.question ?? '', sql: draft.sql, explanation: draft.explanation,
          provider: draft.provider, model: draft.model, tables: draft.tables,
          columnTypes: draft.columnTypes, outputOrder: input.outputOrder ?? [], lastRunAt: null,
          filters: withFilterDefaults(draft.filters ?? [], input.filterValues),
          plan: { ...draft.plan!, filters: withFilterDefaults(draft.filters ?? [], input.filterValues).map(({ id, table, column, operator, defaultValue }) => ({ id, table, column, operator, defaultValue })) },
        } : {}),
      }).where(and(eq(savedQueries.id, input.id), eq(savedQueries.userId, userId))).returning()
      if (!row) throw new SavedQueryNotFoundError()
      return toSavedQuery(row)
    } catch (error) {
      if (isUniqueViolation(error)) throw new SavedQueryNameTakenError()
      throw error
    }
  }

  async copy(userId: string, id: string, name: string): Promise<SavedQuery> {
    const [existing] = await this.db.select().from(savedQueries)
      .where(and(eq(savedQueries.id, id), eq(savedQueries.userId, userId))).limit(1)
    if (!existing) throw new SavedQueryNotFoundError()
    const { id: sourceId, createdAt, updatedAt, lastRunAt, ...values } = existing
    try {
      const [row] = await this.db.insert(savedQueries).values({ ...values, name }).returning()
      return toSavedQuery(row!)
    } catch (error) {
      if (isUniqueViolation(error)) throw new SavedQueryNameTakenError()
      throw error
    }
  }

  async remove(userId: string, id: string): Promise<boolean> {
    const deleted = await this.db
      .delete(savedQueries)
      .where(and(eq(savedQueries.id, id), eq(savedQueries.userId, userId)))
      .returning({ id: savedQueries.id })
    return deleted.length > 0
  }
}
