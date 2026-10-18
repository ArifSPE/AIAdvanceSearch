import { z } from 'zod'
import { llmProviderSchema } from './llm'

const optionalSetting = z.string().trim().min(1).max(256).nullable()

export const providerSettingsInputSchema = z.object({
  provider: llmProviderSchema,
  label: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(256),
  fallbackModel: optionalSetting,
  models: z.array(z.string().trim().min(1).max(256)).max(50),
  enabled: z.boolean(),
  isDefault: z.boolean(),
  awsRegion: z.string().trim().regex(/^[a-z]{2}(?:-[a-z]+)+-\d+$/).nullable(),
  awsProfile: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9_.@+-]+$/).nullable(),
}).superRefine((value, context) => {
  if (value.isDefault && !value.enabled) context.addIssue({ code: 'custom', path: ['enabled'], message: 'The default provider must be enabled' })
})

export const providerSettingsSchema = providerSettingsInputSchema.extend({
  credentialsConfigured: z.boolean(),
  source: z.enum(['environment', 'database']),
})

export const promptInputSchema = z.object({
  id: z.uuid().optional(),
  label: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  question: z.string().trim().min(3).max(2000),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(10000),
})
export const curatedPromptSchema = promptInputSchema.extend({ id: z.uuid() })
export const promptListSchema = z.object({ items: z.array(curatedPromptSchema) })
export const providerSettingsListSchema = z.object({ items: z.array(providerSettingsSchema) })
export type ProviderSettingsInput = z.infer<typeof providerSettingsInputSchema>
export type ProviderSettings = z.infer<typeof providerSettingsSchema>
export type PromptInput = z.infer<typeof promptInputSchema>
export type CuratedPrompt = z.infer<typeof curatedPromptSchema>