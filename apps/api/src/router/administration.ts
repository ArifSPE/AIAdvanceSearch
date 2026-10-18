import { AdministrationService, InvalidProviderConfigurationError } from '../modules/administration/administration.service'
import { pub, requireAdmin, requireAuth } from '../orpc/base'

export const administrationRouter = {
  providers: pub.admin.providers.use(requireAdmin).handler(async ({ context }) => ({ items: await new AdministrationService(context.db).providers() })),
  saveProvider: pub.admin.saveProvider.use(requireAdmin).handler(async ({ input, context, errors }) => {
    try { return await new AdministrationService(context.db).saveProvider(input) }
    catch (error) { if (error instanceof InvalidProviderConfigurationError) throw errors.INVALID_CONFIGURATION(); throw error }
  }),
  prompts: pub.admin.prompts.use(requireAdmin).handler(async ({ context }) => ({ items: await new AdministrationService(context.db).prompts(true) })),
  savePrompt: pub.admin.savePrompt.use(requireAdmin).handler(async ({ input, context, errors }) => {
    const prompt = await new AdministrationService(context.db).savePrompt(input)
    if (!prompt) throw errors.NOT_FOUND()
    return prompt
  }),
  removePrompt: pub.admin.removePrompt.use(requireAdmin).handler(async ({ input, context, errors }) => {
    if (!(await new AdministrationService(context.db).removePrompt(input.id))) throw errors.NOT_FOUND()
  }),
}

export const promptsRouter = {
  list: pub.prompts.list.use(requireAuth).handler(async ({ context }) => ({ items: await new AdministrationService(context.db).prompts() })),
}