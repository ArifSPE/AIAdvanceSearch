import { z } from 'zod'

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  /** Process uptime in seconds. */
  uptime: z.number(),
  database: z.enum(['up', 'down']),
  timestamp: z.string(),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>

export const readyResponseSchema = z.object({ ready: z.literal(true) })

export type ReadyResponse = z.infer<typeof readyResponseSchema>
