import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { createHash } from 'node:crypto'
import { createAppDatabase, createMetadataDatabase } from '@ais/db'
import { llmProviderSchema } from '@ais/shared'
import { llmConfig } from '../src/config/env'
import { QueryGenerationService, queryPlannerSystem, resolveLlmModel } from '../src/modules/llm/query-generation.service'
import { QueryPlanningDecisionError } from '../src/modules/llm/planning-decision'
import { planMeaning, referencePlan, type PlannerEvaluationCase } from '../src/modules/llm/query-evaluation'

function argument(name: string) { const index = process.argv.indexOf(name); return index < 0 ? undefined : process.argv[index + 1] }

async function main() {
  if (!process.argv.includes('--live')) throw new Error('Pass --live to authorize billable model evaluation. Use --limit to bound the number of requests.')
  const limit = Number(argument('--limit') ?? '5')
  if (!Number.isInteger(limit) || limit < 1 || limit > 120) throw new Error('--limit must be between 1 and 120')
  const provider = llmProviderSchema.parse(argument('--provider') ?? llmConfig.defaultProvider)
  const model = argument('--model')
  const family = argument('--case')
  const corpusText = await readFile(new URL('./query-planner.v1.json', import.meta.url), 'utf8')
  const corpus = JSON.parse(corpusText) as { version: string; scenarios: PlannerEvaluationCase[] }
  const cases = corpus.scenarios.filter((scenario) => !family || scenario.id === family).flatMap((scenario) => scenario.prompts.map((question, index) => ({ scenario, question, id: `${scenario.id}-${index + 1}` }))).slice(0, limit)
  if (!cases.length) throw new Error('No evaluation cases matched')
  const app = createAppDatabase({ max: 1 })
  const metadata = createMetadataDatabase({ max: 1 })
  const service = new QueryGenerationService(metadata.db, app.db)
  const results: Array<Record<string, unknown>> = []
  try {
    const effective = await resolveLlmModel(provider, model, app.db)
    for (const test of cases) {
      const started = Date.now()
      try {
        const output = await service.generate({ question: test.question, provider, model, tables: [{ name: 'loans', columns: test.scenario.columns }] }, crypto.randomUUID())
        const matched = test.scenario.expected === 'ready' && output.plan !== null && JSON.stringify(planMeaning(output.plan)) === JSON.stringify(planMeaning(referencePlan(test.scenario)))
        results.push({ id: test.id, category: test.scenario.category, expected: test.scenario.expected, actual: 'ready', passed: matched, unsafeAcceptance: test.scenario.expected !== 'ready', model: output.model, durationMs: Date.now() - started })
      } catch (error) {
        const actual = error instanceof QueryPlanningDecisionError ? error.status : 'error'
        results.push({ id: test.id, category: test.scenario.category, expected: test.scenario.expected, actual, passed: actual === test.scenario.expected, unsafeAcceptance: false, model: error instanceof QueryPlanningDecisionError ? error.modelId ?? null : null, durationMs: Date.now() - started })
      }
      console.log(`${test.id}: ${results.at(-1)!.passed ? 'PASS' : 'FAIL'} (${results.at(-1)!.actual})`)
    }
    const report = { corpusVersion: corpus.version, corpusHash: createHash('sha256').update(corpusText).digest('hex'), plannerPromptHash: createHash('sha256').update(queryPlannerSystem).digest('hex'), createdAt: new Date().toISOString(), provider, requestedModel: model ?? null,
      configuration: { primaryModel: effective.modelId, fallbackModel: effective.providerConfig.fallbackModel ?? null, timeoutMs: llmConfig.timeoutMs, planVersion: 1 },
      limit, total: results.length, passed: results.filter((result) => result.passed).length, unsafeAcceptances: results.filter((result) => result.unsafeAcceptance).length, results }
    const output = resolve(argument('--output') ?? '../../.eval-results/query-planner.json')
    await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify({ ...report, results: undefined, report: output }))
    if (report.passed !== report.total || report.unsafeAcceptances > 0) process.exitCode = 1
  } finally { await Promise.all([app.close(), metadata.close()]) }
}

main().catch((error) => { console.error(error instanceof Error ? error.message : 'Evaluation failed'); process.exitCode = 1 })