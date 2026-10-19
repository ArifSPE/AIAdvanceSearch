import { resolve } from 'node:path'
import { randomBytes } from 'node:crypto'
import { config } from 'dotenv'
import { z } from 'zod'

// Root .env first, then an optional app-local .env that overrides it.
config({ path: resolve(process.cwd(), '../../.env'), quiet: true })
config({ path: resolve(process.cwd(), '.env'), override: true, quiet: true })

// Blank `KEY=` lines in .env arrive as ""; treat them as unset.
const emptyToUndefined = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default('0.0.0.0'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  APP_DB_URL: z.string().min(1, 'APP_DB_URL is required'),
  METADATA_DB_URL: z.string().min(1, 'METADATA_DB_URL is required'),
  QUERY_DB_URL: z.string().min(1, 'QUERY_DB_URL is required for row-secured query execution'),
  JWT_SECRET: z.string().min(32).optional(),
  LLM_PROVIDER: z.enum(['ollama', 'openai', 'anthropic', 'bedrock']).default('ollama'),
  LLM_MODEL: z.string().trim().min(1).optional(),
  LLM_FALLBACK_MODEL: z.string().trim().min(1).optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300000).default(120000),
  LLM_BASE_URL: z.url().default('http://localhost:11434/v1'),
  LLM_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  OLLAMA_MODEL: emptyToUndefined,
  OLLAMA_FALLBACK_MODEL: emptyToUndefined,
  OPENAI_MODEL: emptyToUndefined,
  OPENAI_FALLBACK_MODEL: emptyToUndefined,
  ANTHROPIC_MODEL: emptyToUndefined,
  ANTHROPIC_FALLBACK_MODEL: emptyToUndefined,
  OLLAMA_MODELS: emptyToUndefined,
  OPENAI_MODELS: emptyToUndefined,
  ANTHROPIC_MODELS: emptyToUndefined,
  BEDROCK_MODELS: emptyToUndefined,
  LLM_AWS_REGION: z.string().trim().min(1).optional(),
  AWS_REGION: z.string().trim().min(1).optional(),
  AWS_PROFILE: emptyToUndefined,
  BEDROCK_MODEL_ID: emptyToUndefined,
  BEDROCK_INFERENCE_PROFILE_ID: emptyToUndefined,
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
})
.superRefine((values, context) => {
  if (values.NODE_ENV === 'production' && !values.JWT_SECRET) {
    context.addIssue({
      code: 'custom',
      path: ['JWT_SECRET'],
      message: 'JWT_SECRET is required in production and must be at least 32 characters',
    })
  }

  if (values.NODE_ENV === 'production' && !values.QUERY_DB_URL) {
    context.addIssue({
      code: 'custom',
      path: ['QUERY_DB_URL'],
      message: 'QUERY_DB_URL is required in production so generated queries run as a read-only role',
    })
  }

  if (values.LLM_PROVIDER === 'openai' && !values.OPENAI_API_KEY?.trim()) {
    context.addIssue({
      code: 'custom',
      path: ['OPENAI_API_KEY'],
      message: 'OPENAI_API_KEY is required when LLM_PROVIDER=openai',
    })
  }

  if (values.LLM_PROVIDER === 'anthropic' && !values.ANTHROPIC_API_KEY?.trim()) {
    context.addIssue({
      code: 'custom',
      path: ['ANTHROPIC_API_KEY'],
      message: 'ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic',
    })
  }

  if (
    values.LLM_PROVIDER === 'bedrock' &&
    !values.LLM_AWS_REGION &&
    !values.AWS_REGION &&
    !process.env.AWS_REGION
  ) {
    context.addIssue({
      code: 'custom',
      path: ['LLM_AWS_REGION'],
      message: 'Set LLM_AWS_REGION or AWS_REGION when LLM_PROVIDER=bedrock',
    })
  }
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error(
    `Invalid environment configuration:\n${z.prettifyError(parsed.error)}\n` +
      'Copy .env.example to .env at the repo root.',
  )
  process.exit(1)
}

export const env = parsed.data
export const jwtSecret = env.JWT_SECRET ?? randomBytes(32).toString('base64url')

export const defaultLlmModels = {
  ollama: 'qwen2.5-coder:32b',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  bedrock: 'anthropic.claude-3-5-haiku-20241022-v1:0',
} as const

export type LlmProviderId = keyof typeof defaultLlmModels

export interface LlmProviderConfig {
  provider: LlmProviderId
  label: string
  model: string
  fallbackModel: string | undefined
  /** Models users may pick; the default and fallback models are always included. */
  models: string[]
  apiKey: string | undefined
  awsRegion?: string
  awsProfile?: string
}

export const llmProviderLabels: Record<LlmProviderId, string> = {
  ollama: 'Ollama (local)',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  bedrock: 'Amazon Bedrock',
}

const awsRegion = env.LLM_AWS_REGION ?? env.AWS_REGION ?? process.env.AWS_REGION

// Provider-specific settings win; LLM_MODEL and LLM_FALLBACK_MODEL apply to the default provider only.
function defaultProviderSetting(provider: LlmProviderId, value: string | undefined) {
  return env.LLM_PROVIDER === provider ? value : undefined
}

const providerModelSettings = {
  ollama: { model: env.OLLAMA_MODEL, fallbackModel: env.OLLAMA_FALLBACK_MODEL },
  openai: { model: env.OPENAI_MODEL, fallbackModel: env.OPENAI_FALLBACK_MODEL },
  anthropic: { model: env.ANTHROPIC_MODEL, fallbackModel: env.ANTHROPIC_FALLBACK_MODEL },
} as const

function modelFor(provider: Exclude<LlmProviderId, 'bedrock'>) {
  return providerModelSettings[provider].model ?? defaultProviderSetting(provider, env.LLM_MODEL) ?? defaultLlmModels[provider]
}

function fallbackModelFor(provider: Exclude<LlmProviderId, 'bedrock'>) {
  return providerModelSettings[provider].fallbackModel ?? defaultProviderSetting(provider, env.LLM_FALLBACK_MODEL)
}

function buildProviderConfig(provider: LlmProviderId): Omit<LlmProviderConfig, 'models'> | undefined {
  const base = { provider, label: llmProviderLabels[provider] }
  switch (provider) {
    case 'ollama':
      return {
        ...base,
        model: modelFor('ollama'),
        fallbackModel: fallbackModelFor('ollama') ?? 'llama3.1:latest',
        apiKey: env.LLM_API_KEY?.trim() || undefined,
      }
    case 'openai':
    case 'anthropic': {
      const apiKey = (provider === 'openai' ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY)?.trim()
      if (!apiKey) return undefined
      return {
        ...base,
        model: modelFor(provider),
        fallbackModel: fallbackModelFor(provider),
        apiKey,
      }
    }
    case 'bedrock':
      if (!awsRegion) return undefined
      // An application inference profile ARN is accepted anywhere Bedrock takes a model id.
      return {
        ...base,
        model:
          env.BEDROCK_INFERENCE_PROFILE_ID ??
          env.BEDROCK_MODEL_ID ??
          defaultProviderSetting('bedrock', env.LLM_MODEL) ??
          defaultLlmModels.bedrock,
        fallbackModel: env.BEDROCK_INFERENCE_PROFILE_ID ? env.BEDROCK_MODEL_ID : undefined,
        apiKey: undefined,
      }
  }
}

const extraModelLists: Record<LlmProviderId, string | undefined> = {
  ollama: env.OLLAMA_MODELS,
  openai: env.OPENAI_MODELS,
  anthropic: env.ANTHROPIC_MODELS,
  bedrock: env.BEDROCK_MODELS,
}

function withAllowedModels(config: Omit<LlmProviderConfig, 'models'>): LlmProviderConfig {
  const extras = (extraModelLists[config.provider] ?? '').split(',').map((model) => model.trim())
  const models = [config.model, config.fallbackModel, ...extras].filter((model): model is string => Boolean(model))
  return { ...config, models: [...new Set(models)] }
}

const configuredProviders = (Object.keys(defaultLlmModels) as LlmProviderId[]).flatMap((provider) => {
  const config = buildProviderConfig(provider)
  return config ? [withAllowedModels(config)] : []
})

export const llmConfig = {
  defaultProvider: env.LLM_PROVIDER,
  providers: configuredProviders,
  timeoutMs: env.LLM_TIMEOUT_MS,
  baseUrl: env.LLM_BASE_URL,
  awsRegion,
  awsProfile: env.AWS_PROFILE,
}

export function getLlmProviderConfig(provider: LlmProviderId): LlmProviderConfig | undefined {
  return configuredProviders.find((config) => config.provider === provider)
}

export const isDevelopment = env.NODE_ENV === 'development'

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
