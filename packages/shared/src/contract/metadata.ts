import { oc } from '@orpc/contract'
import { metadataSchemaResponseSchema } from '../schemas/metadata'
import { unauthorizedError } from './errors'

export const metadataContract = {
  schema: oc
    .route({
      method: 'GET',
      path: '/metadata/schema',
      summary: 'Load database schema metadata',
      description: 'Returns active table metadata with each table’s active columns.',
      tags: ['Metadata'],
    })
    .errors(unauthorizedError)
    .output(metadataSchemaResponseSchema),
}