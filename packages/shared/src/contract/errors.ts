export const unauthorizedError = {
  UNAUTHORIZED: { message: 'Authentication required' },
} as const

export const llmFailureErrors = {
  LLM_CONFIGURATION_UNAVAILABLE: { message: 'We could not load the query catalog or AI settings. Ask your IT-Admin to check the database connection, then try again.', status: 503 },
  LLM_CREDENTIALS_EXPIRED: { message: 'The AI provider session has expired. Ask your IT-Admin to refresh the server AWS/SSO sign-in, then try again.', status: 503 },
  LLM_AUTHENTICATION_FAILED: { message: 'The server could not sign in to the AI provider. Ask your IT-Admin to check its API key or AWS credentials.', status: 503 },
  LLM_ACCESS_DENIED: { message: 'The AI provider denied access to the selected model. Ask your IT-Admin to check model permissions and region, or choose another provider.', status: 503 },
  LLM_RATE_LIMITED: { message: 'The AI provider is busy or its usage limit has been reached. Wait a moment and try again, or choose another provider.', status: 429 },
  LLM_TIMEOUT: { message: 'The AI model took too long to respond. Try again, simplify the question, or choose a faster model.', status: 504 },
  LLM_CONNECTION_FAILED: { message: 'The server cannot reach the AI provider. If you selected Ollama, check that it is running; otherwise try again or choose another provider.', status: 503 },
  LLM_INVALID_PLAN: { message: 'The AI model could not build a valid plan for your selection. Review the tables, output columns, and filters, then rephrase the question or choose another model. No query was run.', status: 422 },
  LLM_INVALID_RESPONSE: { message: 'The AI model returned a response the system could not use. Try again or choose another model. No query was run.', status: 502 },
  LLM_UNAVAILABLE: { message: 'We could not get a usable response from the AI provider. Try again or choose another model. If the problem continues, contact your IT-Admin.', status: 502 },
} as const