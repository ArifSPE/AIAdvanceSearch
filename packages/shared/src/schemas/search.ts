import { z } from 'zod'

export const SEARCH_LIMIT_DEFAULT = 20
export const SEARCH_LIMIT_MAX = 100

/**
 * Query string accepted by `GET /api/v1/search`.
 * `limit`/`offset` are coerced because they arrive as strings.
 */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, 'query must not be empty').max(512),
  limit: z.coerce.number().int().min(1).max(SEARCH_LIMIT_MAX).default(SEARCH_LIMIT_DEFAULT),
  offset: z.coerce.number().int().min(0).default(0),
})

export type SearchQuery = z.infer<typeof searchQuerySchema>

export const searchHitSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.url().nullable(),
  /** Highlighted fragment produced by `ts_headline`. May contain <mark> tags. */
  snippet: z.string(),
  score: z.number(),
})

export type SearchHit = z.infer<typeof searchHitSchema>

export const searchResponseSchema = z.object({
  query: z.string(),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
  tookMs: z.number(),
  hits: z.array(searchHitSchema),
})

export type SearchResponse = z.infer<typeof searchResponseSchema>
