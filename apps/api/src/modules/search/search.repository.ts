import type { SearchQuery } from '@ais/shared'
import { type Database, documents, searchQueries, sql } from '@ais/db'

export interface SearchRow {
  id: string
  title: string
  url: string | null
  snippet: string
  score: number
}

/**
 * Postgres full-text search over documents.
 * Swap/extend with a pgvector branch (document_chunks.embedding) for hybrid retrieval.
 */
export class SearchRepository {
  constructor(private readonly db: Database) {}

  async searchDocuments({ q, limit, offset }: SearchQuery): Promise<{
    rows: SearchRow[]
    total: number
  }> {
    const tsQuery = sql`websearch_to_tsquery('english', ${q})`
    const tsVector = sql`to_tsvector('english', ${documents.title} || ' ' || ${documents.content})`
    const matches = sql`${tsVector} @@ ${tsQuery}`

    const [rows, totals] = await Promise.all([
      this.db
        .select({
          id: documents.id,
          title: documents.title,
          url: documents.url,
          snippet: sql<string>`ts_headline(
            'english',
            ${documents.content},
            ${tsQuery},
            'StartSel=<mark>,StopSel=</mark>,MaxFragments=1,MaxWords=40,MinWords=12'
          )`,
          score: sql<number>`ts_rank(${tsVector}, ${tsQuery})::float8`,
        })
        .from(documents)
        .where(matches)
        .orderBy(sql`ts_rank(${tsVector}, ${tsQuery}) desc`)
        .limit(limit)
        .offset(offset),

      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(documents)
        .where(matches),
    ])

    return { rows, total: totals[0]?.total ?? 0 }
  }

  /** Fire-and-forget query log used for analytics and relevance tuning. */
  async recordQuery(input: { query: string; resultCount: number; tookMs: number }): Promise<void> {
    await this.db.insert(searchQueries).values(input)
  }
}
