import { TableMetadataService } from '../modules/metadata/tablemetadata.service'
import { pub, requireAuth } from '../orpc/base'

export const metadataRouter = {
  schema: pub.metadata.schema.use(requireAuth).handler(async ({ context }) => {
    return new TableMetadataService(context.metadataDb).getSchema()
  }),
}