import { oc } from '@orpc/contract'
import {
  executeQueryInputSchema,
  executeQueryResponseSchema,
  generatedQuerySchema,
  llmProvidersResponseSchema,
  queryGenerationInputSchema,
  selectionRecommendationInputSchema,
  selectionRecommendationSchema,
} from '../schemas/llm'
import { unauthorizedError } from './errors'

export const llmContract = {
  recommendSelection: oc
    .route({
      method: 'POST',
      path: '/llm/recommend-selection',
      summary: 'Recommend tables and columns for a question',
      description: 'Uses the LLM to pick tables and output columns from the metadata catalog for a plain-English question.',
      tags: ['LLM'],
    })
    .errors({
      ...unauthorizedError,
      LLM_PROVIDER_NOT_CONFIGURED: { message: 'The selected LLM provider is not configured on the server', status: 400 },
      LLM_MODEL_NOT_ALLOWED: { message: 'The selected model is not allowed for this provider', status: 400 },
      NO_MATCHING_SCHEMA: { message: 'No tables or columns matched this question. Try rephrasing it.', status: 422 },
      LLM_UNAVAILABLE: { message: 'The configured LLM provider could not suggest a selection', status: 502 },
    })
    .input(selectionRecommendationInputSchema)
    .output(selectionRecommendationSchema),

  providers: oc
    .route({
      method: 'GET',
      path: '/llm/providers',
      summary: 'List LLM providers',
      description: 'Providers configured on the server that can be chosen for query generation.',
      tags: ['LLM'],
    })
    .errors(unauthorizedError)
    .output(llmProvidersResponseSchema),

  generateQuery: oc
    .route({
      method: 'POST',
      path: '/llm/generate-query',
      summary: 'Generate a read-only SQL query',
      description: 'Uses selected database metadata and the configured LLM provider to draft PostgreSQL SQL.',
      tags: ['LLM'],
    })
    .errors({
      ...unauthorizedError,
      INVALID_SCHEMA_SELECTION: { message: 'The selected tables or columns are not available', status: 400 },
      LLM_PROVIDER_NOT_CONFIGURED: { message: 'The selected LLM provider is not configured on the server', status: 400 },
      LLM_MODEL_NOT_ALLOWED: { message: 'The selected model is not allowed for this provider', status: 400 },
      LLM_UNAVAILABLE: { message: 'The configured LLM provider could not generate a query', status: 502 },
    })
    .input(queryGenerationInputSchema)
    .output(generatedQuerySchema),

  executeQuery: oc
    .route({
      method: 'POST',
      path: '/llm/execute-query',
      summary: 'Run a generated query safely',
      description: 'Executes a signed query draft as a read-only transaction with a timeout and row limit.',
      tags: ['LLM'],
    })
    .errors({
      ...unauthorizedError,
      INVALID_QUERY_TOKEN: { message: 'The query draft is invalid, expired, or belongs to another user', status: 401 },
      QUERY_EXECUTION_FAILED: { message: 'The read-only query could not be executed', status: 400 },
      INVALID_FILTER_VALUES: { message: 'One or more filter values are invalid', status: 400 },
    })
    .input(executeQueryInputSchema)
    .output(executeQueryResponseSchema),
}