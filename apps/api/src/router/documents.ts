import { DocumentsService } from '../modules/documents/documents.service'
import { pub, requireAuth } from '../orpc/base'

export const documentsRouter = {
  list: pub.documents.list.use(requireAuth).handler(async ({ input, context }) => {
    return new DocumentsService(context.db).list(input)
  }),

  find: pub.documents.find.use(requireAuth).handler(async ({ input, context, errors }) => {
    const document = await new DocumentsService(context.db).findById(input.id)
    if (!document) throw errors.NOT_FOUND()
    return document
  }),

  create: pub.documents.create.use(requireAuth).handler(async ({ input, context }) => {
    return new DocumentsService(context.db).create(input)
  }),

  remove: pub.documents.remove.use(requireAuth).handler(async ({ input, context, errors }) => {
    const removed = await new DocumentsService(context.db).remove(input.id)
    if (!removed) throw errors.NOT_FOUND()
  }),
}
