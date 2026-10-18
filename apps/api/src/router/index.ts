import { pub } from '../orpc/base'
import { authRouter } from './auth'
import { administrationRouter, promptsRouter } from './administration'
import { documentsRouter } from './documents'
import { healthRouter } from './health'
import { llmRouter } from './llm'
import { metadataRouter } from './metadata'
import { savedQueriesRouter } from './saved-queries'
import { searchRouter } from './search'

/** The contract from @ais/shared, fully implemented. */
export const router = pub.router({
  admin: administrationRouter,
  prompts: promptsRouter,
  auth: authRouter,
  health: healthRouter,
  search: searchRouter,
  documents: documentsRouter,
  metadata: metadataRouter,
  llm: llmRouter,
  savedQueries: savedQueriesRouter,
})

export type Router = typeof router
