import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import * as authRepository from '../auth/auth.repository.js'
import { findMessageByIdForOrganization } from '../inbox/repositories/message.repository.js'
import type { RewriteBody, TranslateBody } from './ai.schemas.js'
import { buildRewriteSystemPrompt } from './prompts/rewrite.prompt.js'
import { buildTranslateSystemPrompt } from './prompts/translate.prompt.js'
import { completeChat } from './providers/openai.client.js'
import { translationLanguageSchema } from './translation.constants.js'
import { isTranslatableMessageContent } from './translation.utils.js'

export async function rewriteDraft(input: RewriteBody) {
  const rewritten = await completeChat({
    system: buildRewriteSystemPrompt(),
    user: input.draft,
  })

  return { rewritten }
}

export async function translateMessage(auth: AuthContext, input: TranslateBody) {
  const organization = await authRepository.findOrganizationById(auth.organizationId)
  if (organization === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Organization account not found')
  }

  const parsedTargetLanguage = translationLanguageSchema.safeParse(
    organization.preferred_translation_language,
  )
  if (!parsedTargetLanguage.success) {
    throw new AppError(
      400,
      'BAD_REQUEST',
      'Set your target language in Settings → General before translating messages',
    )
  }

  const targetLanguage = parsedTargetLanguage.data

  const message = await findMessageByIdForOrganization({
    organization_id: auth.organizationId,
    message_id: input.messageId,
  })

  if (message === null) {
    throw new AppError(404, 'NOT_FOUND', 'Message not found')
  }

  if (!isTranslatableMessageContent(message.content)) {
    throw new AppError(400, 'BAD_REQUEST', 'This message cannot be translated')
  }

  const translated = await completeChat({
    system: buildTranslateSystemPrompt(targetLanguage),
    user: message.content,
  })

  return {
    translated,
    targetLanguage,
    original: message.content,
  }
}
