import { queryPlanSchema, type QueryPlan } from '@ais/shared'

export interface PlannerEvaluationCase {
  id: string
  category: string
  expected: 'ready' | 'clarification' | 'unsupported'
  columns: string[]
  projections?: string[]
  filters?: Array<{ column: string; operator: string; defaultValue: unknown }>
  groupBy?: string[]
  orderBy?: Array<{ projection: number; direction: string }>
  prompts: string[]
}

export function referencePlan(scenario: PlannerEvaluationCase): QueryPlan {
  return queryPlanSchema.parse({ version: 1, tables: ['loans'], projections: scenario.columns.map((column, index) => ({ column: `loans.${column}`, aggregate: scenario.projections?.[index] ?? 'none' })),
    joins: [], filters: (scenario.filters ?? []).map((filter, index) => ({ ...filter, id: `filter_${index + 1}`, table: 'loans' })), groupBy: scenario.groupBy ?? [], orderBy: scenario.orderBy ?? [],
  })
}

export function planMeaning(plan: QueryPlan) {
  return {
    tables: [...plan.tables].sort(), projections: plan.projections,
    joins: [...plan.joins].sort((left, right) => left.relationshipId.localeCompare(right.relationshipId)),
    filters: plan.filters.map((filter) => ({ column: `${filter.table}.${filter.column}`, operator: filter.operator, value: filter.defaultValue === null ? null : String(filter.defaultValue) })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
    groupBy: [...plan.groupBy].sort(), orderBy: plan.orderBy,
  }
}