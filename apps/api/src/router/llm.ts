import {
  InvalidQuerySchemaSelectionError,
  LlmModelNotAllowedError,
  LlmProviderNotConfiguredError,
  QueryGenerationService,
} from '../modules/llm/query-generation.service'
import { QueryExecutionService } from '../modules/llm/query-execution.service'
import { listLlmProviders } from '../modules/llm/model'
import { InvalidGeneratedQueryTokenError } from '../modules/llm/query-token'
import { NoMatchingSchemaError, SelectionRecommendationService } from '../modules/llm/selection-recommendation.service'
import { pub, requireAuth } from '../orpc/base'
import { InvalidFilterValuesError } from '../modules/llm/query-filters'
import { QueryPlanningDecisionError } from '../modules/llm/planning-decision'
import { llmFailureCode } from '../modules/llm/llm-failure'

export const llmRouter = {
  providers: pub.llm.providers.use(requireAuth).handler(({ context }) => listLlmProviders(context.db)),

  recommendSelection: pub.llm.recommendSelection.use(requireAuth).handler(async ({ input, context, errors }) => {
    try {
      return await new SelectionRecommendationService(context.metadataDb, context.db).recommend(input)
    } catch (error) {
      if (error instanceof QueryPlanningDecisionError) {
        if (error.status === 'clarification') throw errors.CLARIFICATION_REQUIRED({ message: error.message })
        throw errors.UNSUPPORTED_QUERY({ message: error.message })
      }
      if (error instanceof NoMatchingSchemaError) throw errors.NO_MATCHING_SCHEMA()
      if (error instanceof LlmProviderNotConfiguredError) throw errors.LLM_PROVIDER_NOT_CONFIGURED()
      if (error instanceof LlmModelNotAllowedError) throw errors.LLM_MODEL_NOT_ALLOWED()
      context.logger.error({ err: error }, 'LLM selection recommendation failed')
      throw errors[llmFailureCode(error)]()
    }
  }),

  generateQuery: pub.llm.generateQuery.use(requireAuth).handler(async ({ input, context, errors }) => {
    try {
      return await new QueryGenerationService(context.metadataDb, context.db).generate(input, context.authUser.id)
    } catch (error) {
      if (error instanceof QueryPlanningDecisionError) {
        if (error.status === 'clarification') throw errors.CLARIFICATION_REQUIRED({ message: error.message })
        throw errors.UNSUPPORTED_QUERY({ message: error.message })
      }
      if (error instanceof InvalidQuerySchemaSelectionError) {
        throw errors.INVALID_SCHEMA_SELECTION()
      }
      if (error instanceof LlmProviderNotConfiguredError) {
        throw errors.LLM_PROVIDER_NOT_CONFIGURED()
      }
      if (error instanceof LlmModelNotAllowedError) {
        throw errors.LLM_MODEL_NOT_ALLOWED()
      }
      context.logger.error({ err: error }, 'LLM query generation failed')
      throw errors[llmFailureCode(error)]()
    }
  }),

  executeQuery: pub.llm.executeQuery.use(requireAuth).handler(async ({ input, context, errors }) => {
    try {
      return await new QueryExecutionService(context.queryDb, context.metadataDb).execute(input.queryToken, context.authUser.id, input.filterValues)
    } catch (error) {
      if (error instanceof InvalidGeneratedQueryTokenError) throw errors.INVALID_QUERY_TOKEN()
      if (error instanceof InvalidFilterValuesError) throw errors.INVALID_FILTER_VALUES()
      context.logger.error({ err: error }, 'Generated query execution failed')
      throw errors.QUERY_EXECUTION_FAILED()
    }
  }),
}