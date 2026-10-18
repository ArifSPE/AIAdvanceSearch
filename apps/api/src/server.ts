import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import Fastify from 'fastify'
import { corsOrigins } from './config/env'
import { loggerOptions } from './lib/logger'
import dbPlugin from './plugins/db'
import { orpcPlugin } from './plugins/orpc'

/** Builds a fully wired, not-yet-listening Fastify instance (handy for tests). */
export async function buildServer() {
  const app = Fastify({
    logger: loggerOptions,
    trustProxy: true,
  })

  await app.register(helmet, { contentSecurityPolicy: false })
  await app.register(cors, { origin: corsOrigins, credentials: true, methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'] })

  await app.register(dbPlugin)

  // oRPC owns /api/v1/** and shapes its own error responses.
  await app.register(orpcPlugin)

  return app
}

export type AppInstance = Awaited<ReturnType<typeof buildServer>>
