import { API_PREFIX } from '@ais/shared'
import { OpenAPIHandler } from '@orpc/openapi/fastify'
import { onError } from '@orpc/server'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { env } from '../config/env'
import { getAuthenticatedUser } from '../modules/auth/tokens'
import { getOpenApiSpec } from '../orpc/spec'
import { router } from '../router/index'

const handler = new OpenAPIHandler(router, {
  interceptors: [
    onError((error) => {
      // oRPC already shapes the client response; this is just server-side visibility.
      if (process.env.NODE_ENV !== 'test') console.error(error)
    }),
  ],
})

/**
 * Mounts the oRPC OpenAPI handler. REST paths come from `.route()` in the
 * contract, so there are no Fastify route declarations to keep in sync.
 *
 * Fastify parses the body itself and the adapter reuses it (falling back to the
 * raw stream), so the default JSON parser is all this needs. Content types with
 * no registered Fastify parser are rejected with 415 before reaching oRPC.
 */
export async function orpcPlugin(app: FastifyInstance) {
  const handleRequest = async (request: FastifyRequest, reply: FastifyReply) => {
    const { matched } = await handler.handle(request, reply, {
      prefix: API_PREFIX,
      context: {
        db: app.db,
        metadataDb: app.metadataDb,
        queryDb: app.queryDb,
        authUser: await getAuthenticatedUser(request.headers.authorization),
        logger: request.log,
      },
    })

    if (matched) return reply

    return reply.status(404).send({
      code: 'NOT_FOUND',
      status: 404,
      message: `No route for ${request.method} ${request.url}`,
    })
  }

  app.all(`${API_PREFIX}/*`, handleRequest)
  app.all(API_PREFIX, handleRequest)

  // Machine-readable spec, generated from the same contract.
  app.get('/openapi.json', async (request, reply) => {
    const base = `${request.protocol}://${request.host}${API_PREFIX}`
    return reply.send(await getOpenApiSpec(base))
  })

  // Scalar reference UI, loaded from a CDN so it costs no dependency.
  app.get('/docs', async (_request, reply) => {
    reply.type('text/html').send(`<!doctype html>
<html>
  <head>
    <title>AI Advance Search API</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="app"></div>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    <script>
      Scalar.createApiReference('#app', { url: '/openapi.json' })
    </script>
  </body>
</html>`)
  })

  if (env.NODE_ENV === 'development') {
    app.log.info(`oRPC mounted at ${API_PREFIX} · spec /openapi.json · docs /docs`)
  }
}
