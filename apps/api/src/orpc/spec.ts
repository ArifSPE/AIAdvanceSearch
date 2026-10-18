import { contract } from '@ais/shared'
import { OpenAPIGenerator } from '@orpc/openapi'
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4'

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
})

/**
 * Generated from the contract, so the spec can never drift from the routes.
 * Built once on first request and cached.
 */
let cached: Promise<object> | undefined

export function getOpenApiSpec(baseUrl: string) {
  cached ??= generator.generate(contract, {
    info: {
      title: 'AI Advance Search API',
      version: '0.1.0',
      description: 'Full-text and (soon) vector search over indexed documents.',
    },
    servers: [{ url: baseUrl }],
    tags: [
      { name: 'Health', description: 'Liveness and readiness probes' },
      { name: 'Search', description: 'Query the document index' },
      { name: 'Documents', description: 'Manage indexed documents' },
    ],
  })

  return cached
}
