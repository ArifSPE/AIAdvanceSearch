import { type Database, desc, documents, eq, sql } from '@ais/db'
import type { CreateDocumentInput, ListDocumentsQuery } from '@ais/shared'

const listColumns = {
  id: documents.id,
  title: documents.title,
  url: documents.url,
  source: documents.source,
  status: documents.status,
  createdAt: documents.createdAt,
}

export class DocumentsRepository {
  constructor(private readonly db: Database) {}

  async list({ limit, offset, status }: ListDocumentsQuery) {
    const where = status ? eq(documents.status, status) : undefined

    const [rows, totals] = await Promise.all([
      this.db
        .select(listColumns)
        .from(documents)
        .where(where)
        .orderBy(desc(documents.createdAt))
        .limit(limit)
        .offset(offset),
      this.db.select({ total: sql<number>`count(*)::int` }).from(documents).where(where),
    ])

    return { rows, total: totals[0]?.total ?? 0 }
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1)
    return row ?? null
  }

  async create(input: CreateDocumentInput) {
    const [row] = await this.db
      .insert(documents)
      .values({ ...input, url: input.url ?? null })
      .returning(listColumns)

    if (!row) throw new Error('insert returned no row')
    return row
  }

  async remove(id: string) {
    const deleted = await this.db
      .delete(documents)
      .where(eq(documents.id, id))
      .returning({ id: documents.id })

    return deleted.length > 0
  }
}
