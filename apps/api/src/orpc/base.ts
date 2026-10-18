import { eq, users, type Database } from '@ais/db'
import type { AuthenticatedUser } from '@ais/shared'
import { contract } from '@ais/shared'
import { implement, ORPCError } from '@orpc/server'
import type { FastifyBaseLogger } from 'fastify'

/** Per-request context, supplied by src/plugins/orpc.ts. */
export interface ApiContext {
  db: Database
  metadataDb: Database
  queryDb: Database
  authUser: AuthenticatedUser | null
  logger: FastifyBaseLogger
}

/**
 * Contract-bound builder. Procedures built from `pub` are checked against
 * @ais/shared at compile time and validated against it at runtime.
 */
export const pub = implement(contract).$context<ApiContext>()

export const requireAuth = pub.middleware(async ({ context, next }) => {
  if (!context.authUser) {
    throw new ORPCError('UNAUTHORIZED', {
      status: 401,
      message: 'Authentication required',
    })
  }
  return next({ context: { authUser: context.authUser } })
})

export const requireAdmin = pub.middleware(async ({ context, next }) => {
  if (!context.authUser) throw new ORPCError('UNAUTHORIZED', { status: 401, message: 'Authentication required' })
  const [user] = await context.db.select({ role: users.role }).from(users).where(eq(users.id, context.authUser.id)).limit(1)
  if (user?.role !== 'IT-Admin') throw new ORPCError('FORBIDDEN', { status: 403, message: 'IT-Admin role required' })
  return next({ context: { authUser: { ...context.authUser, role: user.role } } })
})

/** Example middleware: logs how long each procedure takes. */
export const timed = pub.middleware(async ({ next, path, context }) => {
  const startedAt = performance.now()
  try {
    return await next()
  } finally {
    context.logger.debug(
      { procedure: path.join('.'), ms: Math.round(performance.now() - startedAt) },
      'procedure finished',
    )
  }
})
