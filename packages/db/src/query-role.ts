import postgres from 'postgres'
import { loadDatabaseUrl } from './env'
import { LENDING_TABLE_NAMES } from './metadata.seed'

/**
 * Creates (or re-syncs) the SELECT-only role named in QUERY_DB_URL, using the
 * APP_DB_URL admin connection. Safe to re-run; run it after migrations/seeding
 * and whenever the set of queryable tables changes.
 */
async function main() {
  const adminUrl = loadDatabaseUrl()
  const queryUrl = new URL(loadDatabaseUrl('QUERY_DB_URL'))
  const role = decodeURIComponent(queryUrl.username)
  const password = decodeURIComponent(queryUrl.password)

  if (!role || !password) throw new Error('QUERY_DB_URL must include a username and password.')
  if (role === decodeURIComponent(new URL(adminUrl).username)) {
    throw new Error('QUERY_DB_URL must use a different role than APP_DB_URL.')
  }

  const sql = postgres(adminUrl, { max: 1 })

  try {
    const [existing] = await sql<{ exists: boolean }[]>`
      select exists (select 1 from pg_roles where rolname = ${role}) as exists`
    const exists = existing!.exists
    const verb = exists ? 'ALTER' : 'CREATE'

    // Utility statements take no bind parameters, so Postgres quotes the role and password.
    const [statement] = await sql<{ ddl: string }[]>`
      select format(
        ${`${verb} ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`}::text,
        ${role}::text,
        ${password}::text
      ) as ddl`
    await sql.unsafe(statement!.ddl)

    const [current] = await sql<{ db: string }[]>`select current_database() as db`
    const db = current!.db
    await sql`ALTER ROLE ${sql(role)} SET default_transaction_read_only = on`
    await sql`ALTER ROLE ${sql(role)} SET statement_timeout = '5s'`
    await sql`GRANT CONNECT ON DATABASE ${sql(db)} TO ${sql(role)}`
    await sql`GRANT USAGE ON SCHEMA public TO ${sql(role)}`
    await sql`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${sql(role)}`

    for (const table of LENDING_TABLE_NAMES) {
      await sql`GRANT SELECT ON TABLE ${sql(`public.${table}`)} TO ${sql(role)}`
    }

    console.log(
      `${exists ? 'updated' : 'created'} read-only role "${role}" with SELECT on ${LENDING_TABLE_NAMES.length} tables`,
    )
  } finally {
    await sql.end({ timeout: 5 })
  }
}

main().catch((error) => {
  console.error('query role setup failed:', error)
  process.exit(1)
})
