import { SearchService } from '../modules/search/search.service'
import { pub, requireAuth, timed } from '../orpc/base'

export const searchRouter = {
  query: pub.search.query.use(timed).use(requireAuth).handler(async ({ input, context }) => {
    const service = new SearchService(context.db, context.logger)
    return service.search(input)
  }),
}
