import { z } from 'zod'
import { queryFilterInputSchema } from './query-filter'

export const planIdentifierSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,62}$/)
export const qualifiedColumnSchema = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,62}\.[A-Za-z_][A-Za-z0-9_]{0,62}$/)
export const queryPlanSchema = z.object({
  version: z.literal(1),
  tables: z.array(planIdentifierSchema).min(1).max(8),
  projections: z.array(z.object({
    column: qualifiedColumnSchema,
    aggregate: z.enum(['none', 'count', 'sum', 'avg', 'min', 'max']),
  }).strict()).min(1).max(64),
  joins: z.array(z.object({
    relationshipId: z.string().min(1).max(260),
    type: z.enum(['inner', 'left']),
  }).strict()).max(7),
  filters: z.array(queryFilterInputSchema.strict()).max(20),
  groupBy: z.array(qualifiedColumnSchema).max(64),
  orderBy: z.array(z.object({ projection: z.number().int().min(0).max(63), direction: z.enum(['asc', 'desc']) }).strict()).max(8),
}).strict()

export const queryPlanningOutputSchema = z.object({
  status: z.enum(['ready', 'clarification', 'unsupported']),
  explanation: z.string().trim().min(1).max(4000),
  clarification: z.string().trim().min(1).max(1000).nullable(),
  plan: queryPlanSchema.nullable(),
}).strict()

export type QueryPlan = z.infer<typeof queryPlanSchema>
export type QueryPlanningOutput = z.infer<typeof queryPlanningOutputSchema>