import { createAppDatabase, createMetadataDatabase, createQueryDatabase } from '@ais/db'
import fp from 'fastify-plugin'
import { env, isDevelopment } from '../config/env'

/**
 * Decorates the instance with `app.db` and closes the pool on shutdown.
 * The connection is lazy, so a cold Postgres does not block boot.
 */
export default fp(
  async (app) => {
    const appDatabase = createAppDatabase({
      debug: isDevelopment && env.LOG_LEVEL === 'trace',
    })
    const metadataDatabase = createMetadataDatabase({
      debug: isDevelopment && env.LOG_LEVEL === 'trace',
    })

    app.decorate('db', appDatabase.db)
    app.decorate('metadataDb', metadataDatabase.db)

    // Generated SQL runs as a SELECT-only role; dev falls back to the app role (production requires it).
    const queryDatabase = env.QUERY_DB_URL ? createQueryDatabase({ max: 5 }) : undefined
    if (!queryDatabase) {
      app.log.warn('QUERY_DB_URL is not set: generated queries run with the application database role')
    }
    app.decorate('queryDb', queryDatabase?.db ?? appDatabase.db)

    app.addHook('onClose', async () => {
      await Promise.all([appDatabase.close(), metadataDatabase.close(), queryDatabase?.close()])
    })
  },
  { name: 'db' },
)
