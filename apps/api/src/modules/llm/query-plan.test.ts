import { describe, expect, it } from 'vitest'
import { queryPlanSchema } from '@ais/shared'
import { approvedRelationships, compileQueryPlan, materializeReviewedPlan, reviewedPlanningSchema } from './query-plan'
import { testCatalog } from '../../../tests/helpers/query-catalog'

export const basePlan = queryPlanSchema.parse({ version: 1, tables: ['loans'], projections: [{ column: 'loans.loan_number', aggregate: 'none' }], joins: [], filters: [], groupBy: [], orderBy: [] })

describe('constrained query-plan compiler', () => {
  it('materializes reviewed output and filters without asking the model to copy them', () => {
    const proposal = { version: 1, tables: ['loans'], projectionAggregates: ['none'], joins: [], groupBy: [], orderBy: [] }
    const reviewed = [{ id: 'user_filter_42', table: 'loans', column: 'outstanding_balance', operator: 'gte' as const, defaultValue: '500000' }]
    const plan = materializeReviewedPlan(proposal, ['loans.id'], reviewed)
    expect(plan.projections).toEqual([{ column: 'loans.id', aggregate: 'none' }])
    expect(plan.filters).toEqual(reviewed)
    expect(() => compileQueryPlan(plan, testCatalog, { selectedColumns: ['loans.id'], filters: reviewed })).not.toThrow()
  })
  it('keeps reviewed no-filter decisions and rejects model-supplied projection/filter overrides', () => {
    const proposal = { version: 1, tables: ['loans'], projectionAggregates: ['none'], joins: [], groupBy: [], orderBy: [] }
    expect(materializeReviewedPlan(proposal, ['loans.id'], []).filters).toEqual([])
    const schema = reviewedPlanningSchema(['loans.id'], []).shape.plan
    expect(schema.safeParse({ ...proposal, filters: [{ id: 'made_up' }] }).success).toBe(false)
    expect(schema.safeParse({ ...proposal, projections: [{ column: 'loans.loan_number', aggregate: 'none' }] }).success).toBe(false)
    expect(schema.safeParse({ ...proposal, projectionAggregates: [] }).success).toBe(false)
  })
  it('allows model-proposed filters only when no reviewed list was supplied', () => {
    const proposal = { version: 1, tables: ['loans'], projectionAggregates: ['none'], joins: [], groupBy: [], orderBy: [], filters: [{ id: 'balance', table: 'loans', column: 'outstanding_balance', operator: 'gte', defaultValue: '500000' }] }
    expect(materializeReviewedPlan(proposal, ['loans.loan_number']).filters).toEqual(proposal.filters)
  })
  it('compiles reviewed projections, bound filters, and ordinal sorting', () => {
    const plan = { ...basePlan, filters: [{ id: 'balance', table: 'loans', column: 'outstanding_balance', operator: 'gte', defaultValue: '500000' }], orderBy: [{ projection: 0, direction: 'asc' }] }
    const result = compileQueryPlan(plan, testCatalog, { selectedColumns: ['loans.loan_number'] })
    expect(result.sql).toContain('$1')
    expect(result.sql).not.toContain('500000')
    expect(result.sql).toMatch(/ORDER BY.*1.*ASC/)
  })
  it('only joins relationships derived from metadata', () => {
    const relationship = approvedRelationships(testCatalog).find((entry) => entry.childTable === 'loans')!
    expect(compileQueryPlan({ ...basePlan, tables: ['loans', 'borrowers'], joins: [{ relationshipId: relationship.id, type: 'inner' }] }, testCatalog).sql).toContain('JOIN')
    expect(() => compileQueryPlan({ ...basePlan, tables: ['loans', 'borrowers'], joins: [{ relationshipId: 'loans.id=borrowers.id', type: 'inner' }] }, testCatalog)).toThrow('Unapproved relationship')
    expect(() => compileQueryPlan({ ...basePlan, tables: ['loans', 'branches'] }, testCatalog)).toThrow('connected')
  })
  it('compiles supported aggregation and enforces exact grouping', () => {
    const plan = { ...basePlan, projections: [{ column: 'loans.status', aggregate: 'none' }, { column: 'loans.outstanding_balance', aggregate: 'sum' }], groupBy: ['loans.status'] }
    const result = compileQueryPlan(plan, testCatalog)
    expect(result.sql).toContain('sum_loans_outstanding_balance')
    expect(result.sql).toContain('GROUP BY')
    expect(() => compileQueryPlan({ ...plan, groupBy: [] }, testCatalog)).toThrow('Grouping')
    expect(() => compileQueryPlan({ ...basePlan, projections: [{ column: 'loans.status', aggregate: 'sum' }] }, testCatalog)).toThrow('numeric')
  })
  it('rejects raw SQL fields, expressions, unknown objects, and invalid sorting', () => {
    expect(() => compileQueryPlan({ ...basePlan, sql: 'SELECT * FROM users' }, testCatalog)).toThrow()
    expect(() => compileQueryPlan({ ...basePlan, projections: [{ column: 'pg_read_file()', aggregate: 'none' }] }, testCatalog)).toThrow()
    expect(() => compileQueryPlan({ ...basePlan, tables: ['users'] }, testCatalog)).toThrow('Unapproved table')
    expect(() => compileQueryPlan({ ...basePlan, orderBy: [{ projection: 10, direction: 'asc' }] }, testCatalog)).toThrow('sort')
  })
  it('cannot broaden reviewed output or recreate removed filters', () => {
    expect(() => compileQueryPlan(basePlan, testCatalog, { selectedColumns: ['loans.id'] })).toThrow('Unselected')
    expect(() => compileQueryPlan({ ...basePlan, filters: [{ id: 'status', table: 'loans', column: 'status', operator: 'eq', defaultValue: 'active' }] }, testCatalog, { filters: [] })).toThrow('reviewed filter')
  })
})