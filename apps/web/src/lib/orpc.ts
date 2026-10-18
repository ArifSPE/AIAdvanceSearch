import { contract } from '@ais/shared'
import { createORPCClient } from '@orpc/client'
import type { ContractRouterClient } from '@orpc/contract'
import type { JsonifiedClient } from '@orpc/openapi-client'
import { OpenAPILink } from '@orpc/openapi-client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { clientEnv } from './env'

const link = new OpenAPILink(contract, {
  url: clientEnv.apiUrl,
  headers: () => {
    if (typeof window === 'undefined') return {}
    const token = window.sessionStorage.getItem('ais_access_token')
    return token ? { authorization: `Bearer ${token}` } : {}
  },

  // Search results are per-request; never let Next or the browser serve a stale one.
  fetch: (request, init) => globalThis.fetch(request, { ...init, cache: 'no-store' }),
})

/**
 * Typed from the contract, so `client.documents.find({ id })` knows its input,
 * its output, and that it can throw NOT_FOUND. JsonifiedClient reflects that
 * values arrive as JSON (Date becomes string, etc.).
 */
export const client: JsonifiedClient<ContractRouterClient<typeof contract>> =
  createORPCClient(link)

/** TanStack Query bindings: orpc.search.query.queryOptions({ input }). */
export const orpc = createTanstackQueryUtils(client)
