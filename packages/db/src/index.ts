export * from './client'
export * from './schema/index'

// Re-exported so consumers never need a direct drizzle-orm dependency.
export {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm'
export { cosineDistance } from 'drizzle-orm'
