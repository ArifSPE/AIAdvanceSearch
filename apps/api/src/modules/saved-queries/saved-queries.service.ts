import { and, desc, eq, savedQueries, type Database, type SavedQueryRow } from '@ais/db'
import { llmProviderSchema, type ExecuteQueryResponse, type SaveQueryInput, type SavedQuery, type UpdateSavedQueryInput } from '@ais/shared'
import { QueryExecutionService } from '../llm/query-execution.service'
import { createGeneratedQueryToken, verifyGeneratedQueryToken } from '../llm/query-token'
import { TableMetadataService } from '../metadata/tablemetadata.service'

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
        })
        .returning()
      return toSavedQuery(row!)
    } catch (error) {
      if (isUniqueViolation(error)) throw new SavedQueryNameTakenError()
      throw error
    }
  }

  async run(userId: string, id: string): Promise<ExecuteQueryResponse> {
    const [row] = await this.db
      .select()
      .from(savedQueries)
      .where(and(eq(savedQueries.id, id), eq(savedQueries.userId, userId)))
      .limit(1)
    if (!row) throw new SavedQueryNotFoundError()

    // Deactivating a table or column in metadata also revokes saved queries that use it.
    const { tables: activeTables } = await new TableMetadataService(this.metadataDb).getSchema()
    for (const table of row.tables) {
      const active = activeTables.find((candidate) => candidate.name === table.name)
      if (!active) throw new SavedQueryOutdatedError(table.name)
      const missing = table.columns.find((column) => !active.columns.some((candidate) => candidate.name === column))
      if (missing) throw new SavedQueryOutdatedError(`${table.name}.${missing}`)
    }

    const payload = {
      sql: row.sql,
      explanation: row.explanation,
      question: row.question,
      provider: llmProviderSchema.parse(row.provider),
      model: row.model,
      tables: row.tables,
      columnTypes: row.columnTypes,
    }
    const queryToken = await createGeneratedQueryToken(userId, payload)
    const response = await new QueryExecutionService(this.queryDb).run(payload, queryToken)

    await this.db.update(savedQueries).set({ lastRunAt: new Date() }).where(eq(savedQueries.id, row.id))
    return response
  }

  async update(userId: string, input: UpdateSavedQueryInput): Promise<SavedQuery> {
    const [existing] = await this.db.select().from(savedQueries)
      .where(and(eq(savedQueries.id, input.id), eq(savedQueries.userId, userId))).limit(1)
    if (!existing) throw new SavedQueryNotFoundError()
    const draft = input.queryToken ? await verifyGeneratedQueryToken(input.queryToken, userId) : undefined
    try {
      const [row] = await this.db.update(savedQueries).set({
        name: input.name,
        ...(draft ? {
          question: draft.question ?? '', sql: draft.sql, explanation: draft.explanation,
          provider: draft.provider, model: draft.model, tables: draft.tables,
          columnTypes: draft.columnTypes, outputOrder: input.outputOrder ?? [], lastRunAt: null,
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
