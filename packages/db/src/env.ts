import { resolve } from 'node:path'
import { config } from 'dotenv'

/**
 * Drizzle Kit and the seed script run with cwd = packages/db, so the root .env
 * has to be loaded explicitly. A package-local .env wins if present.
 */
export function loadDatabaseUrl(
  variable: 'APP_DB_URL' | 'METADATA_DB_URL' | 'QUERY_DB_URL' = 'APP_DB_URL',
): string {
  config({ path: resolve(process.cwd(), '../../.env'), quiet: true })
  config({ path: resolve(process.cwd(), '.env'), override: true, quiet: true })

  const url = process.env[variable]
  if (!url) {
    throw new Error(
      `${variable} is not set. Copy .env.example to .env at the repo root (see README).`,
    )
  }
  return url
}
