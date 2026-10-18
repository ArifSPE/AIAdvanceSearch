import { oc } from '@orpc/contract'
import { searchQuerySchema, searchResponseSchema } from '../schemas/search'
import { unauthorizedError } from './errors'

export const searchContract = {
  query: oc
    .route({
      method: 'GET',
      path: '/search',
      summary: 'Search documents',
      description:
        'Postgres full-text search. Snippets contain <mark> tags around matched terms.',
      tags: ['Search'],
    })
    .errors(unauthorizedError)
    .input(searchQuerySchema)
    .output(searchResponseSchema),
}
