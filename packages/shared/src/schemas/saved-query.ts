import { z } from 'zod'
import { llmProviderSchema } from './llm'

export const savedQueryIdSchema = z.object({ id: z.uuid() })

export const saveQueryInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  /** Signed draft from generate-query; the server never accepts raw SQL to save. */
  queryToken: z.string().trim().min(1).max(30000),
  /** `table.column` display order, used to restore the selection in the editor. */
  outputOrder: z.array(z.string().trim().min(3).max(127)).max(512).default([]),
})

export const updateSavedQueryInputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
  queryToken: z.string().trim().min(1).max(30000).optional(),
  outputOrder: z.array(z.string().trim().min(3).max(127)).max(512).optional(),
})

export const copySavedQueryInputSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(120),
})

export const savedQuerySchema = z.object({
  id: z.string(),
  name: z.string(),
  question: z.string(),
  sql: z.string(),
  explanation: z.string(),
  provider: llmProviderSchema,
  model: z.string(),
  tableNames: z.array(z.string()),
  outputOrder: z.array(z.string()),
  lastRunAt: z.string().nullable(),
  createdAt: z.string(),
})

export const savedQueryListSchema = z.object({
  items: z.array(savedQuerySchema),
})

export type SaveQueryInput = z.infer<typeof saveQueryInputSchema>
export type UpdateSavedQueryInput = z.infer<typeof updateSavedQueryInputSchema>
export type SavedQuery = z.infer<typeof savedQuerySchema>
export type SavedQueryList = z.infer<typeof savedQueryListSchema>
