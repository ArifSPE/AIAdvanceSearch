import { authContract } from './auth'
import { administrationContract, promptsContract } from './administration'
import { documentsContract } from './documents'
import { healthContract } from './health'
import { llmContract } from './llm'
import { metadataContract } from './metadata'
import { savedQueriesContract } from './saved-queries'
import { searchContract } from './search'

/**
 * The API surface, declared once. The server implements it (apps/api/src/router)
 * and the browser client is typed from it (apps/web/src/lib/orpc.ts), so a change
 * here becomes a compile error on both sides rather than a runtime surprise.
 *
 * Paths are relative to the handler prefix — see API_PREFIX.
 */
export const contract = {
  admin: administrationContract,
  prompts: promptsContract,
  auth: authContract,
  health: healthContract,
  search: searchContract,
  documents: documentsContract,
  metadata: metadataContract,
  llm: llmContract,
  savedQueries: savedQueriesContract,
}

export type Contract = typeof contract

export {
  authContract,
  documentsContract,
  healthContract,
  llmContract,
  metadataContract,
  savedQueriesContract,
  searchContract,
}
