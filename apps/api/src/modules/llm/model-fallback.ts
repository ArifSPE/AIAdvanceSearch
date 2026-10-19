export interface ModelCandidate {
  modelId: string
}

export class NonRetryableGenerationError extends Error {}

export interface ModelGenerationResult<T, M extends ModelCandidate> {
  value: T
  model: M
  attempts: number
}

export async function generateWithFallback<M extends ModelCandidate, T>(
  models: readonly M[],
  generate: (model: M) => Promise<T>,
): Promise<ModelGenerationResult<T, M>> {
  const errors: unknown[] = []

  for (const [index, model] of models.entries()) {
    try {
      return { value: await generate(model), model, attempts: index + 1 }
    } catch (error) {
      if (error instanceof NonRetryableGenerationError) throw error
      errors.push(error)
    }
  }

  throw new AggregateError(
    errors,
    `All configured LLM models failed: ${models.map(({ modelId }) => modelId).join(', ')}`,
  )
}