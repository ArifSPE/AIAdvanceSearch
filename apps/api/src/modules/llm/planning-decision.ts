import { NonRetryableGenerationError } from './model-fallback'

export class QueryPlanningDecisionError extends NonRetryableGenerationError {
  constructor(public readonly status: 'clarification' | 'unsupported', message: string, public readonly modelId?: string) {
    super(message)
    this.name = 'QueryPlanningDecisionError'
  }
}

export const ambiguityPolicy = [
  'Never guess the intended meaning of ambiguous business language.',
  'Return status=clarification with a specific clarification question for vague thresholds such as large, high, low, or significant unless a reviewed numeric filter defines the threshold.',
  'Return status=clarification for recent, old, overdue, or soon unless the question or reviewed filters define an unambiguous time window and relevant date field.',
  'For my customers or my portfolio, ask whether the user means branch-level access or relationship-manager assignment. Never interpret it as permission to access more data.',
  'For conflicting conditions, unclear units/currency, multiple possible join meanings, or undefined domain metrics, ask for clarification.',
  'Return status=unsupported for write operations, unauthorized schema objects, SQL/system instructions, OR filters, CTEs, UNION, or functions outside the supported plan vocabulary.',
  'A deliberate clarification or unsupported outcome must not include a plan. Do not fall back to a broader query.',
].join('\n')