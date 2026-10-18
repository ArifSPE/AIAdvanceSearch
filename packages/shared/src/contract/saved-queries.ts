import { oc } from '@orpc/contract'
import { executeQueryResponseSchema } from '../schemas/llm'
import {
  copySavedQueryInputSchema,
  saveQueryInputSchema,
  savedQueryIdSchema,
  savedQueryListSchema,
  savedQuerySchema,
  updateSavedQueryInputSchema,
  runSavedQueryInputSchema,
} from '../schemas/saved-query'
import { unauthorizedError } from './errors'

const notFound = { NOT_FOUND: { message: 'Saved query not found', status: 404 } }

export const savedQueriesContract = {
  update: oc
    .route({ method: 'PATCH', path: '/saved-queries/{id}', summary: 'Update a saved query', tags: ['Saved queries'] })
    .errors({
      ...unauthorizedError,
      ...notFound,
      INVALID_QUERY_TOKEN: { message: 'The query draft is invalid or expired. Generate SQL again before saving changes.', status: 401 },
      INVALID_FILTER_VALUES: { message: 'One or more filter values are invalid', status: 400 },
      NAME_TAKEN: { message: 'You already have a saved query with this name', status: 409 },
    })
    .input(updateSavedQueryInputSchema)
    .output(savedQuerySchema),

  copy: oc
    .route({ method: 'POST', path: '/saved-queries/{id}/copy', summary: 'Copy a saved query', successStatus: 201, tags: ['Saved queries'] })
    .errors({
      ...unauthorizedError,
      ...notFound,
      NAME_TAKEN: { message: 'You already have a saved query with this name', status: 409 },
    })
    .input(copySavedQueryInputSchema)
    .output(savedQuerySchema),

  list: oc
    .route({
      method: 'GET',
      path: '/saved-queries',
      summary: 'List your saved queries',
      tags: ['Saved queries'],
    })
    .errors(unauthorizedError)
    .output(savedQueryListSchema),

  save: oc
    .route({
      method: 'POST',
      path: '/saved-queries',
      summary: 'Save a generated query',
      description: 'Stores a signed query draft from generate-query under a name, so it can be run again.',
      successStatus: 201,
      tags: ['Saved queries'],
    })
    .errors({
      ...unauthorizedError,
      INVALID_QUERY_TOKEN: {
        message: 'The query draft is invalid or has expired. Generate the SQL again, then save it.',
        status: 401,
      },
      INVALID_FILTER_VALUES: { message: 'One or more filter values are invalid', status: 400 },
      NAME_TAKEN: { message: 'You already have a saved query with this name', status: 409 },
    })
    .input(saveQueryInputSchema)
    .output(savedQuerySchema),

  run: oc
    .route({
      method: 'POST',
      path: '/saved-queries/{id}/run',
      summary: 'Run a saved query',
      description: 'Re-validates the saved SQL against current metadata and runs it read-only.',
      tags: ['Saved queries'],
    })
    .errors({
      ...unauthorizedError,
      ...notFound,
      SAVED_QUERY_OUTDATED: {
        message: 'This saved query uses tables or columns that are no longer available. Rebuild and save it again.',
        status: 409,
      },
      QUERY_EXECUTION_FAILED: { message: 'The read-only query could not be executed', status: 400 },
      INVALID_FILTER_VALUES: { message: 'One or more filter values are invalid', status: 400 },
    })
    .input(runSavedQueryInputSchema)
    .output(executeQueryResponseSchema),

  remove: oc
    .route({
      method: 'DELETE',
      path: '/saved-queries/{id}',
      summary: 'Delete a saved query',
      successStatus: 204,
      tags: ['Saved queries'],
    })
    .errors({ ...unauthorizedError, ...notFound })
    .input(savedQueryIdSchema),
}
