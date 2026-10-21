export class InvalidGeneratedPlanError extends Error {
  constructor(cause: unknown) {
    super('The model plan did not match the validated query requirements', { cause })
    this.name = 'InvalidGeneratedPlanError'
  }
}

export type LlmFailureCode = 'LLM_CONFIGURATION_UNAVAILABLE' | 'LLM_CREDENTIALS_EXPIRED' | 'LLM_AUTHENTICATION_FAILED' | 'LLM_ACCESS_DENIED' | 'LLM_RATE_LIMITED' | 'LLM_TIMEOUT' | 'LLM_CONNECTION_FAILED' | 'LLM_INVALID_PLAN' | 'LLM_INVALID_RESPONSE' | 'LLM_UNAVAILABLE'

function classify(error: unknown): LlmFailureCode {
  if (!error || typeof error !== 'object') return 'LLM_UNAVAILABLE'
  if (error instanceof InvalidGeneratedPlanError) return 'LLM_INVALID_PLAN'
  const record = error as Record<string, unknown>
  if (typeof record.message === 'string' && record.message.startsWith('Failed query:')) return 'LLM_CONFIGURATION_UNAVAILABLE'
  const text = [record.name, record.code, record.message].filter((value) => typeof value === 'string').join(' ').toLowerCase()
  const status = typeof record.statusCode === 'number' ? record.statusCode : typeof record.status === 'number' ? record.status : undefined
  if (/expiredtoken|token.*expired|session.*expired|sso.*expired|expiration.*sso/.test(text)) return 'LLM_CREDENTIALS_EXPIRED'
  if (status === 401 || /credentialsprovidererror|credential.*(?:not found|could not|failed|invalid|missing)|invalid.*(?:api.key|access.key|security.token)|unrecognizedclientexception|unable to locate credentials|could not load credentials/.test(text)) return 'LLM_AUTHENTICATION_FAILED'
  if (status === 403 || /accessdenied|access denied|forbidden|not authorized to (?:invoke|access)/.test(text)) return 'LLM_ACCESS_DENIED'
  if (status === 429 || /throttl|toomanyrequests|rate.?limit|quota.*exceed/.test(text)) return 'LLM_RATE_LIMITED'
  if (status === 408 || status === 504 || /timeouterror|timeout|timed out|aborterror/.test(text)) return 'LLM_TIMEOUT'
  if (/econnrefused|enotfound|eai_again|econnreset|fetch failed|network error|socket hang up/.test(text)) return 'LLM_CONNECTION_FAILED'
  if (/noobjectgenerated|typevalidation|jsonparse|zoderror|schema validation|invalid json|did not return.*json|no output generated/.test(text)) return 'LLM_INVALID_RESPONSE'
  return 'LLM_UNAVAILABLE'
}

export function llmFailureCode(error: unknown): LlmFailureCode {
  const seen = new Set<object>()
  const codes: LlmFailureCode[] = []
  function visit(value: unknown, depth: number) {
    if (!value || typeof value !== 'object' || seen.has(value) || depth > 8 || seen.size >= 30) return
    seen.add(value)
    const code = classify(value)
    if (code !== 'LLM_UNAVAILABLE') codes.push(code)
    if (value instanceof InvalidGeneratedPlanError || code === 'LLM_CONFIGURATION_UNAVAILABLE') return
    const record = value as Record<string, unknown>
    if (Array.isArray(record.errors)) for (const child of record.errors) visit(child, depth + 1)
    visit(record.cause, depth + 1)
  }
  visit(error, 0)
  const actionRequired: LlmFailureCode[] = ['LLM_CONFIGURATION_UNAVAILABLE', 'LLM_CREDENTIALS_EXPIRED', 'LLM_AUTHENTICATION_FAILED', 'LLM_ACCESS_DENIED', 'LLM_RATE_LIMITED']
  for (const code of actionRequired) if (codes.includes(code)) return code
  return codes.at(-1) ?? 'LLM_UNAVAILABLE'
}