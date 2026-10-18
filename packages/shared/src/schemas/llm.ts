import { z } from 'zod'

export const llmProviderSchema = z.enum(['ollama', 'openai', 'anthropic', 'bedrock'])

export const llmProvidersResponseSchema = z.object({
  defaultProvider: llmProviderSchema,
  providers: z.array(
    z.object({
      id: llmProviderSchema,
      label: z.string(),
      /** Default model for the provider. */
      model: z.string(),
      /** Models a user may choose for this provider; always includes `model`. */
      models: z.array(z.string()),
      /** False when the provider is configured but cannot currently be reached. */
      available: z.boolean(),
    }),
  ),
})

export const queryGenerationInputSchema = z.object({
  question: z.string().trim().min(3).max(2000),
  /** Defaults to the server's configured provider. */
  provider: llmProviderSchema.optional(),
  /** Must be one of the provider's allowed models; defaults to the provider's model. */
  model: z.string().trim().min(1).max(256).optional(),
  /** `table.column` names in the order the user wants them displayed. */
  outputOrder: z.array(z.string().trim().min(3).max(127)).max(512).optional(),
  tables: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(63),
        columns: z.array(z.string().trim().min(1).max(63)).min(1).max(64),
      }),
    )
    .min(1)
    .max(8)
    .superRefine((tables, context) => {
      const tableNames = new Set<string>()
      for (const [index, table] of tables.entries()) {
        if (tableNames.has(table.name)) {
          context.addIssue({ code: 'custom', path: [index, 'name'], message: 'table names must be unique' })
        }
        tableNames.add(table.name)

        if (new Set(table.columns).size !== table.columns.length) {
          context.addIssue({
            code: 'custom',
            path: [index, 'columns'],
            message: 'column names must be unique within each table',
          })
        }
      }
    }),
})

export const generatedQuerySchema = z.object({
  sql: z.string().trim().min(1).max(20000),
  explanation: z.string().trim().min(1).max(4000),
  provider: llmProviderSchema,
  model: z.string().min(1),
  queryToken: z.string().min(1),
})

export const selectionRecommendationInputSchema = z.object({
  question: z.string().trim().min(3).max(2000),
  provider: llmProviderSchema.optional(),
  model: z.string().trim().min(1).max(256).optional(),
})

export const selectionRecommendationSchema = z.object({
  tables: z.array(z.object({ name: z.string(), columns: z.array(z.string()).min(1) })).min(1).max(8),
  /** `table.column` names in the suggested display order. */
  outputOrder: z.array(z.string()),
  explanation: z.string(),
  provider: llmProviderSchema,
  model: z.string().min(1),
})

export const executeQueryInputSchema = z.object({
  queryToken: z.string().trim().min(1).max(30000),
})

export const queryExecutionResultSchema = z.object({
  columns: z.array(z.object({ name: z.string(), type: z.string() })),
  rows: z.array(z.record(z.string(), z.unknown())),
  rowCount: z.number().int().nonnegative(),
  truncated: z.boolean(),
})

export const executeQueryResponseSchema = generatedQuerySchema.extend({
  result: queryExecutionResultSchema,
})

export type LlmProvider = z.infer<typeof llmProviderSchema>
export type LlmProvidersResponse = z.infer<typeof llmProvidersResponseSchema>
export type QueryGenerationInput = z.infer<typeof queryGenerationInputSchema>
export type SelectionRecommendationInput = z.infer<typeof selectionRecommendationInputSchema>
export type SelectionRecommendation = z.infer<typeof selectionRecommendationSchema>
export type GeneratedQuery = z.infer<typeof generatedQuerySchema>
export type ExecuteQueryInput = z.infer<typeof executeQueryInputSchema>
export type QueryExecutionResult = z.infer<typeof queryExecutionResultSchema>
export type ExecuteQueryResponse = z.infer<typeof executeQueryResponseSchema>