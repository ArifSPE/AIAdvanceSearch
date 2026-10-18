import type { Database } from '@ais/db'

declare module 'fastify' {
  interface FastifyInstance {
    /** Drizzle client, decorated by src/plugins/db.ts */
    db: Database
    /** Drizzle client for table and column metadata storage. */
    metadataDb: Database
    /** Read-only client for executing generated queries. */
    queryDb: Database
  }
}
