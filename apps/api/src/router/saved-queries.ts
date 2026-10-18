import { InvalidGeneratedQueryTokenError } from '../modules/llm/query-token'
import {
  SavedQueriesService,
  SavedQueryNameTakenError,
  SavedQueryNotFoundError,
  SavedQueryOutdatedError,
} from '../modules/saved-queries/saved-queries.service'
import { pub, requireAuth } from '../orpc/base'
import type { ApiContext } from '../orpc/base'

function service(context: ApiContext) {
  return new SavedQueriesService(context.db, context.metadataDb, context.queryDb)
}

export const savedQueriesRouter = {
  update: pub.savedQueries.update.use(requireAuth).handler(async ({ input, context, errors }) => {
    try {
      return await service(context).update(context.authUser.id, input)
    } catch (error) {
      if (error instanceof SavedQueryNotFoundError) throw errors.NOT_FOUND()
      if (error instanceof InvalidGeneratedQueryTokenError) throw errors.INVALID_QUERY_TOKEN()
      if (error instanceof SavedQueryNameTakenError) throw errors.NAME_TAKEN()
      throw error
    }
  }),

  copy: pub.savedQueries.copy.use(requireAuth).handler(async ({ input, context, errors }) => {
    try {
      return await service(context).copy(context.authUser.id, input.id, input.name)
    } catch (error) {
      if (error instanceof SavedQueryNotFoundError) throw errors.NOT_FOUND()
      if (error instanceof SavedQueryNameTakenError) throw errors.NAME_TAKEN()
      throw error
    }
  }),

  list: pub.savedQueries.list.use(requireAuth).handler(async ({ context }) => ({
    items: await service(context).list(context.authUser.id),
  })),

  save: pub.savedQueries.save.use(requireAuth).handler(async ({ input, context, errors }) => {
    try {
      return await service(context).save(context.authUser.id, input)
    } catch (error) {
      if (error instanceof InvalidGeneratedQueryTokenError) throw errors.INVALID_QUERY_TOKEN()
      if (error instanceof SavedQueryNameTakenError) throw errors.NAME_TAKEN()
      throw error
    }
  }),

  run: pub.savedQueries.run.use(requireAuth).handler(async ({ input, context, errors }) => {
    try {
      return await service(context).run(context.authUser.id, input.id)
    } catch (error) {
      if (error instanceof SavedQueryNotFoundError) throw errors.NOT_FOUND()
      if (error instanceof SavedQueryOutdatedError) throw errors.SAVED_QUERY_OUTDATED()
      context.logger.error({ err: error }, 'Saved query execution failed')
      throw errors.QUERY_EXECUTION_FAILED()
    }
  }),

  remove: pub.savedQueries.remove.use(requireAuth).handler(async ({ input, context, errors }) => {
    if (!(await service(context).remove(context.authUser.id, input.id))) throw errors.NOT_FOUND()
  }),
}
