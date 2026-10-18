import { oc } from '@orpc/contract'
import { healthResponseSchema, readyResponseSchema } from '../schemas/health'

export const healthContract = {
  check: oc
    .route({
      method: 'GET',
      path: '/health',
      summary: 'Liveness probe',
      description: 'Always 200 while the process is up; reports database reachability in the body.',
      tags: ['Health'],
    })
    .output(healthResponseSchema),

  ready: oc
    .route({
      method: 'GET',
      path: '/ready',
      summary: 'Readiness probe',
      description: 'Returns 503 until the database answers.',
      tags: ['Health'],
    })
    .errors({
      SERVICE_UNAVAILABLE: { message: 'Database is unreachable' },
    })
    .output(readyResponseSchema),
}
