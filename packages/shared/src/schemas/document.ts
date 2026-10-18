import { z } from 'zod'

export const documentStatusSchema = z.enum(['pending', 'indexed', 'failed'])
export type DocumentStatus = z.infer<typeof documentStatusSchema>

export const documentIdSchema = z.object({ id: z.uuid() })

export const documentSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.url().nullable(),
  source: z.string(),
  status: documentStatusSchema,
  createdAt: z.string(),
})

export type Document = z.infer<typeof documentSchema>

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(512),
  content: z.string().trim().min(1),
  url: z.url().nullable().optional(),
  source: z.string().trim().min(1).max(64).default('upload'),
})

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>

export const listDocumentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  status: documentStatusSchema.optional(),
})

export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>

export const documentListSchema = z.object({
  items: z.array(documentSchema),
  total: z.number().int(),
  limit: z.number().int(),
  offset: z.number().int(),
})

export type DocumentList = z.infer<typeof documentListSchema>
