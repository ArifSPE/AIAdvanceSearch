import { oc } from '@orpc/contract'
import { z } from 'zod'
import { providerSettingsInputSchema, providerSettingsListSchema, providerSettingsSchema, promptInputSchema, curatedPromptSchema, promptListSchema } from '../schemas/administration'
import { unauthorizedError } from './errors'

const adminErrors = {
  ...unauthorizedError,
  FORBIDDEN: { message: 'IT-Admin role required', status: 403 },
}

export const administrationContract = {
  providers: oc.route({ method: 'GET', path: '/admin/providers', tags: ['Administration'] }).errors(adminErrors).output(providerSettingsListSchema),
  saveProvider: oc.route({ method: 'PUT', path: '/admin/providers', tags: ['Administration'] }).errors({ ...adminErrors, INVALID_CONFIGURATION: { message: 'The provider requires server credentials or an AWS region before it can be enabled', status: 400 } }).input(providerSettingsInputSchema).output(providerSettingsSchema),
  prompts: oc.route({ method: 'GET', path: '/admin/prompts', tags: ['Administration'] }).errors(adminErrors).output(promptListSchema),
  savePrompt: oc.route({ method: 'PUT', path: '/admin/prompts', tags: ['Administration'] }).errors({ ...adminErrors, NOT_FOUND: { message: 'Prompt not found', status: 404 } }).input(promptInputSchema).output(curatedPromptSchema),
  removePrompt: oc.route({ method: 'DELETE', path: '/admin/prompts/{id}', successStatus: 204, tags: ['Administration'] }).errors({ ...adminErrors, NOT_FOUND: { message: 'Prompt not found', status: 404 } }).input(z.object({ id: z.uuid() })),
}

export const promptsContract = {
  list: oc.route({ method: 'GET', path: '/prompts', tags: ['Prompts'] }).errors(unauthorizedError).output(promptListSchema),
}