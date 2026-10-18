import { env } from './config/env'
import { buildServer } from './server'

const app = await buildServer()

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} received, shutting down`)
    void app.close().then(() => process.exit(0))
  })
}

try {
  await app.listen({ port: env.PORT, host: env.HOST })
} catch (error) {
  app.log.error({ err: error }, 'failed to start server')
  process.exit(1)
}
