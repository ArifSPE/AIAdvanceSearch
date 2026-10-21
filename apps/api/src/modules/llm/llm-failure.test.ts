import { describe, expect, it } from 'vitest'
import { InvalidGeneratedPlanError, llmFailureCode } from './llm-failure'

describe('safe user-facing LLM failures', () => {
  it.each([
    [{ name: 'ExpiredTokenException', message: 'Token is expired' }, 'LLM_CREDENTIALS_EXPIRED'],
    [{ message: "AWS credential provider failed: Token is expired. Run aws sso login" }, 'LLM_CREDENTIALS_EXPIRED'],
    [{ name: 'CredentialsProviderError', message: 'Could not load credentials' }, 'LLM_AUTHENTICATION_FAILED'],
    [{ statusCode: 401, message: 'Invalid API key' }, 'LLM_AUTHENTICATION_FAILED'],
    [{ statusCode: 403, message: 'Forbidden' }, 'LLM_ACCESS_DENIED'],
    [{ name: 'ThrottlingException' }, 'LLM_RATE_LIMITED'],
    [{ statusCode: 429 }, 'LLM_RATE_LIMITED'],
    [{ name: 'TimeoutError' }, 'LLM_TIMEOUT'],
    [{ message: 'The operation was aborted due to timeout' }, 'LLM_TIMEOUT'],
    [{ code: 'ECONNREFUSED' }, 'LLM_CONNECTION_FAILED'],
    [{ name: 'AI_NoObjectGeneratedError' }, 'LLM_INVALID_RESPONSE'],
    [new InvalidGeneratedPlanError(new Error('Unselected output column: internal_table.secret')), 'LLM_INVALID_PLAN'],
  ])('maps a failure to %s without returning the original details', (error, expected) => {
    expect(llmFailureCode(error)).toBe(expected)
  })

  it('unwraps aggregate and causal errors and prefers actionable server-authentication failures', () => {
    const error = new AggregateError([new Error('unrecognized'), new Error('provider failed', { cause: { statusCode: 403 } }), new Error('Token is expired')])
    expect(llmFailureCode(error)).toBe('LLM_CREDENTIALS_EXPIRED')
  })
  it('handles cycles and arbitrary failures without leaking messages', () => {
    const error = { message: 'private API key sk-private-value', cause: null as unknown }
    error.cause = error
    expect(llmFailureCode(error)).toBe('LLM_UNAVAILABLE')
    expect(llmFailureCode('private details')).toBe('LLM_UNAVAILABLE')
    expect(llmFailureCode(null)).toBe('LLM_UNAVAILABLE')
  })
  it('does not mislabel catalog or configuration database errors as provider failures', () => {
    const error = new Error('Failed query: SELECT private_settings', { cause: { code: 'ECONNREFUSED' } })
    expect(llmFailureCode(error)).toBe('LLM_CONFIGURATION_UNAVAILABLE')
  })
})