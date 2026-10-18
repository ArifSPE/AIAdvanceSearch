import { asc, curatedPrompts, eq, llmProviderSettings, sql, type Database } from '@ais/db'
import type { PromptInput, ProviderSettings, ProviderSettingsInput } from '@ais/shared'
import { defaultLlmModels, env, getLlmProviderConfig, llmConfig, llmProviderLabels, type LlmProviderConfig, type LlmProviderId } from '../../config/env'

export class InvalidProviderConfigurationError extends Error {}

export class AdministrationService {
  constructor(private readonly db: Database) {}

  async providers(): Promise<ProviderSettings[]> {
    const rows = await this.db.select().from(llmProviderSettings)
    return (Object.keys(defaultLlmModels) as LlmProviderId[]).map((provider) => {
      const stored = rows.find((row) => row.provider === provider)
      const fallback = getLlmProviderConfig(provider)
      const awsRegion = stored?.awsRegion ?? llmConfig.awsRegion ?? null
      const credentialsConfigured = provider === 'ollama' || (provider === 'bedrock' ? Boolean(awsRegion) : Boolean((provider === 'openai' ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY)?.trim()))
      return {
        provider,
        label: stored?.label ?? fallback?.label ?? llmProviderLabels[provider],
        model: stored?.model ?? fallback?.model ?? defaultLlmModels[provider],
        fallbackModel: stored ? stored.fallbackModel : fallback?.fallbackModel ?? null,
        models: stored?.models ?? fallback?.models ?? [defaultLlmModels[provider]],
        enabled: stored?.enabled ?? Boolean(fallback),
        isDefault: stored?.isDefault ?? (!rows.some((row) => row.isDefault) && provider === llmConfig.defaultProvider),
        awsRegion: provider === 'bedrock' ? awsRegion : null,
        awsProfile: provider === 'bedrock' ? stored?.awsProfile ?? llmConfig.awsProfile ?? null : null,
        credentialsConfigured,
        source: stored ? 'database' : 'environment',
      }
    })
  }

  async runtimeProviders(): Promise<{ defaultProvider: LlmProviderId; providers: LlmProviderConfig[] }> {
    const settings = await this.providers()
    const available = settings.filter((setting) => setting.enabled && setting.credentialsConfigured)
    const providers = available.map((setting): LlmProviderConfig => ({
      provider: setting.provider, label: setting.label, model: setting.model,
      fallbackModel: setting.fallbackModel ?? undefined,
      models: [...new Set([setting.model, ...(setting.fallbackModel ? [setting.fallbackModel] : []), ...setting.models])],
      apiKey: setting.provider === 'openai' ? env.OPENAI_API_KEY?.trim() : setting.provider === 'anthropic' ? env.ANTHROPIC_API_KEY?.trim() : setting.provider === 'ollama' ? env.LLM_API_KEY?.trim() || undefined : undefined,
      awsRegion: setting.awsRegion ?? undefined,
      awsProfile: setting.awsProfile ?? undefined,
    }))
    return { defaultProvider: available.find((setting) => setting.isDefault)?.provider ?? providers[0]?.provider ?? llmConfig.defaultProvider, providers }
  }

  async saveProvider(input: ProviderSettingsInput): Promise<ProviderSettings> {
    const configured = (await this.providers()).find((setting) => setting.provider === input.provider)!
    const ready = input.provider === 'bedrock' ? Boolean(input.awsRegion ?? llmConfig.awsRegion) : configured.credentialsConfigured
    if (input.enabled && !ready) throw new InvalidProviderConfigurationError()
    const models = [...new Set([input.model, ...(input.fallbackModel ? [input.fallbackModel] : []), ...input.models])]
    await this.db.transaction(async (transaction) => {
      await transaction.execute(sql`SELECT pg_advisory_xact_lock(741821)`)
      if (input.isDefault) await transaction.update(llmProviderSettings).set({ isDefault: false })
      const values = { ...input, models }
      await transaction.insert(llmProviderSettings).values(values).onConflictDoUpdate({ target: llmProviderSettings.provider, set: values })
    })
    return (await this.providers()).find((setting) => setting.provider === input.provider)!
  }

  async prompts(includeDisabled = false) {
    return this.db.select().from(curatedPrompts).where(includeDisabled ? undefined : eq(curatedPrompts.enabled, true))
      .orderBy(asc(curatedPrompts.sortOrder), asc(curatedPrompts.category), asc(curatedPrompts.label))
  }

  async savePrompt(input: PromptInput) {
    if (input.id) {
      const [row] = await this.db.update(curatedPrompts).set(input).where(eq(curatedPrompts.id, input.id)).returning()
      return row ?? null
    }
    const [row] = await this.db.insert(curatedPrompts).values(input).returning()
    return row!
  }

  async removePrompt(id: string) {
    const deleted = await this.db.delete(curatedPrompts).where(eq(curatedPrompts.id, id)).returning({ id: curatedPrompts.id })
    return deleted.length > 0
  }
}