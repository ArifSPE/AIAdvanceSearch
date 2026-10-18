/** Prefix the oRPC handler is mounted under; also the client's base URL path. */
export const API_PREFIX = '/api/v1' as const

export interface Paginated<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
