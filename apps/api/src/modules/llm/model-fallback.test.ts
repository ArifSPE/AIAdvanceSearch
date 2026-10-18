import { describe, expect, it, vi } from 'vitest'
import { generateWithFallback } from './model-fallback'

const models = [{ modelId: 'qwen2.5-coder:32b' }, { modelId: 'llama3.1:latest' }]

describe('generateWithFallback', () => {
  it('uses the fallback model after the primary model fails', async () => {
    const generate = vi.fn(async (model: (typeof models)[number]) => {
      if (model.modelId === 'qwen2.5-coder:32b') throw new Error('model unavailable')
      return 'SELECT 1'
    })

    await expect(generateWithFallback(models, generate)).resolves.toEqual({
      value: 'SELECT 1',
      model: models[1],
      attempts: 2,
    })
    expect(generate).toHaveBeenCalledTimes(2)
  })

  it('does not call the fallback when the primary succeeds', async () => {
    const generate = vi.fn().mockResolvedValue('SELECT 1')

    await expect(generateWithFallback(models, generate)).resolves.toMatchObject({
      model: models[0],
      attempts: 1,
    })
    expect(generate).toHaveBeenCalledOnce()
  })

  it('reports all failures when no model succeeds', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('unavailable'))

    await expect(generateWithFallback(models, generate)).rejects.toThrow(
      'All configured LLM models failed: qwen2.5-coder:32b, llama3.1:latest',
    )
    expect(generate).toHaveBeenCalledTimes(2)
  })
})