import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema/index'

export interface CreateDatabaseOptions {
  /** Max pool size. Use 1 for one-shot scripts and migrations. */
  max?: number
  /** Log every generated SQL statement. */
  debug?: boolean
}

/**
 * Builds a lazily-connecting Drizzle client. Nothing hits the network until the
 * first query, so a server can boot while Postgres is still starting up.
 */
export function createDatabase(connectionString: string, options: CreateDatabaseOptions = {}) {
  const sql = postgres(connectionString, {
    max: options.max ?? 10,
    idle_timeout: 20,
    connect_timeout: 10,
  })

  const db = drizzle({ client: sql, schema, casing: 'snake_case', logger: options.debug ?? false })

  return {
    db,
    /** Raw postgres.js client, for `LISTEN`/`COPY`/anything Drizzle does not cover. */
    sql,
    close: () => sql.end({ timeout: 5 }),
  }
}

function createDatabaseFromEnv(
  variable: 'APP_DB_URL' | 'METADATA_DB_URL' | 'QUERY_DB_URL',
  options: CreateDatabaseOptions = {},
) {
  const connectionString = process.env[variable]
  if (!connectionString) {
    throw new Error(`${variable} is not set.`)
  }

  return createDatabase(connectionString, options)
}

/** Creates a connection to the application database from APP_DB_URL. */
export function createAppDatabase(options: CreateDatabaseOptions = {}) {
  return createDatabaseFromEnv('APP_DB_URL', options)
}

/** Creates a connection to the metadata database from METADATA_DB_URL. */
export function createMetadataDatabase(options: CreateDatabaseOptions = {}) {
  return createDatabaseFromEnv('METADATA_DB_URL', options)
}

/** Creates the least-privilege read-only connection used to run generated queries. */
export function createQueryDatabase(options: CreateDatabaseOptions = {}) {
  return createDatabaseFromEnv('QUERY_DB_URL', options)
}

export type DatabaseHandle = ReturnType<typeof createDatabase>
export type AppDatabaseHandle = ReturnType<typeof createAppDatabase>
export type MetadataDatabaseHandle = ReturnType<typeof createMetadataDatabase>
export type Database = DatabaseHandle['db']
export type Schema = typeof schema
