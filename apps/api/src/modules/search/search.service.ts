import type { Database } from '@ais/db'
import type { SearchQuery, SearchResponse } from '@ais/shared'
import type { FastifyBaseLogger } from 'fastify'
import { SearchRepository } from './search.repository'

export class SearchService {
  private readonly repository: SearchRepository

  constructor(
    db: Database,
    private readonly logger: FastifyBaseLogger,
  ) {
    this.repository = new SearchRepository(db)
  }

  async search(query: SearchQuery): Promise<SearchResponse> {
    const startedAt = performance.now()
    const { rows, total } = await this.repository.searchDocuments(query)
    const tookMs = Math.round((performance.now() - startedAt) * 100) / 100

    // Logging the query must never fail the request.
    void this.repository
      .recordQuery({ query: query.q, resultCount: total, tookMs })
      .catch((error: unknown) => {
        this.logger.warn({ err: error }, 'failed to record search query')
      })

    return {
      query: query.q,
      total,
      limit: query.limit,
      offset: query.offset,
      tookMs,
      hits: rows,
    }
  }
}
