import { oc } from '@orpc/contract'
import {
  createDocumentSchema,
  documentIdSchema,
  documentListSchema,
  documentSchema,
  listDocumentsQuerySchema,
} from '../schemas/document'
import { unauthorizedError } from './errors'

/** Typed error shared by the routes that look a document up by id. */
const notFound = { NOT_FOUND: { message: 'Document not found' } }

export const documentsContract = {
  list: oc
    .route({
      method: 'GET',
      path: '/documents',
      summary: 'List documents',
      tags: ['Documents'],
    })
    .errors(unauthorizedError)
    .input(listDocumentsQuerySchema)
    .output(documentListSchema),

  find: oc
    .route({
      method: 'GET',
      path: '/documents/{id}',
      summary: 'Get a document by id',
      tags: ['Documents'],
    })
    .errors({ ...notFound, ...unauthorizedError })
    .input(documentIdSchema)
    .output(documentSchema),

  create: oc
    .route({
      method: 'POST',
      path: '/documents',
      summary: 'Create a document',
      description: 'Stored with status "pending" until an indexing worker embeds it.',
      successStatus: 201,
      tags: ['Documents'],
    })
    .errors(unauthorizedError)
    .input(createDocumentSchema)
    .output(documentSchema),

  remove: oc
    .route({
      method: 'DELETE',
      path: '/documents/{id}',
      summary: 'Delete a document',
      successStatus: 204,
      tags: ['Documents'],
    })
    .errors({ ...notFound, ...unauthorizedError })
    .input(documentIdSchema),
}
