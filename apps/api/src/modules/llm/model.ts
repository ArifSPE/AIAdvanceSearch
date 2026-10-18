import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { fromNodeProviderChain } from '@aws-sdk/credential-providers'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LlmProvidersResponse } from '@ais/shared'
import { llmConfig, type LlmProviderConfig } from '../../config/env'
import type { Database } from '@ais/db'
import { AdministrationService } from '../administration/administration.service'

export function createLanguageModel(config: LlmProviderConfig, modelId = config.model) {
  switch (config.provider) {
    case 'ollama':
      return createOpenAICompatible({
        name: 'local-llama',
        baseURL: llmConfig.baseUrl,
        apiKey: config.apiKey ?? 'local',
        // Sends a JSON schema that Ollama enforces during decoding, so replies always parse.
        supportsStructuredOutputs: true,
      }).chatModel(modelId)
    case 'openai':
      return createOpenAI({ apiKey: config.apiKey }).chat(modelId)
    case 'anthropic':
      return createAnthropic({ apiKey: config.apiKey }).languageModel(modelId)
    case 'bedrock':
      // The SDK ignores AWS_PROFILE on its own; the provider chain also resolves SSO profiles.
      return createAmazonBedrock({
        region: config.awsRegion ?? llmConfig.awsRegion,
        credentialProvider: fromNodeProviderChain({ profile: config.awsProfile ?? llmConfig.awsProfile }),
      }).languageModel(modelId)
  }
}

/** Chosen (or default) model first, then the provider's fallback. */
export function createLanguageModels(config: LlmProviderConfig, preferredModel = config.model) {
  const modelIds = [...new Set([preferredModel, ...(config.fallbackModel ? [config.fallbackModel] : [])])]
  return modelIds.map((modelId) => ({ modelId, model: createLanguageModel(config, modelId) }))
}

async function isOllamaReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${llmConfig.baseUrl.replace(/\/$/, '')}/models`, {
      signal: AbortSignal.timeout(1500),
    })
    return response.ok
  } catch {
    return false
  }
}

export async function listLlmProviders(db?: Database): Promise<LlmProvidersResponse> {
  const runtime = db ? await new AdministrationService(db).runtimeProviders() : llmConfig
  const providers = await Promise.all(
    runtime.providers.map(async (config) => ({
      id: config.provider,
      label: config.label,
      model: config.model,
      models: config.models,
      // Only the local server is probed; cloud providers are checked when a query is generated.
      available: config.provider === 'ollama' ? await isOllamaReachable() : true,
    })),
  )
  return { defaultProvider: runtime.defaultProvider, providers }
}
