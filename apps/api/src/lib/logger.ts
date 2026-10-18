import type { FastifyServerOptions } from 'fastify'
import { env, isDevelopment } from '../config/env'

/** Pretty, human-readable logs in dev; raw JSON lines everywhere else. */
export const loggerOptions: FastifyServerOptions['logger'] = {
  level: env.LOG_LEVEL,
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
        },
      }
    : {}),
  redact: ['req.headers.authorization', 'req.headers.cookie'],
}
