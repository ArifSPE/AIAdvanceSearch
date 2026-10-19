import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { queryPlanningOutputSchema } from '@ais/shared'
import { referencePlan, planMeaning, type PlannerEvaluationCase } from './query-evaluation'
import { compileQueryPlan } from './query-plan'
import { testCatalog } from '../../../tests/helpers/query-catalog'

const corpus = JSON.parse(readFileSync(new URL('../../../evals/query-planner.v1.json', import.meta.url), 'utf8')) as { version: string; scenarios: PlannerEvaluationCase[] }

describe('versioned planner evaluation corpus', () => {
  it('contains 120 uniquely identified cases with clear, ambiguous, and adversarial coverage', () => {
    expect(corpus.version).toBe('1.0.0')
    expect(corpus.scenarios).toHaveLength(24)
    expect(corpus.scenarios.reduce((sum, scenario) => sum + scenario.prompts.length, 0)).toBe(120)
    expect(new Set(corpus.scenarios.map((scenario) => scenario.id)).size).toBe(24)
    for (const status of ['ready', 'clarification', 'unsupported']) expect(corpus.scenarios.filter((scenario) => scenario.expected === status).length).toBe(8)
  })
  for (const scenario of corpus.scenarios.filter((entry) => entry.expected === 'ready')) {
    it(`compiles the reviewed reference for ${scenario.id}`, () => {
      const plan = referencePlan(scenario)
      const compiled = compileQueryPlan(plan, testCatalog)
      expect(planMeaning(compiled.plan)).toEqual(planMeaning(plan))
      expect(compiled.sql).toContain('SELECT')
    })
  }
  it('rejects raw SQL smuggled into a planning response', () => {
    expect(queryPlanningOutputSchema.safeParse({ status: 'ready', explanation: 'Test', clarification: null, plan: referencePlan(corpus.scenarios[0]!), sql: 'SELECT * FROM users' }).success).toBe(false)
  })
})