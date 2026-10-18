import { sql } from '@ais/db'
import type { HealthResponse } from '@ais/shared'
import { pub } from '../orpc/base'

async function isDatabaseUp(db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> }) {
  try {
    await db.execute(sql`select 1`)
    return true
  } catch {
    return false
  }
}

export const healthRouter = {
  check: pub.health.check.handler(async ({ context }): Promise<HealthResponse> => {
    const up = await isDatabaseUp(context.db)
    if (!up) context.logger.warn('database health check failed')

    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      database: up ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    }
  }),

  ready: pub.health.ready.handler(async ({ context, errors }) => {
    if (!(await isDatabaseUp(context.db))) {
      throw errors.SERVICE_UNAVAILABLE()
    }
    return { ready: true as const }
  }),
}
