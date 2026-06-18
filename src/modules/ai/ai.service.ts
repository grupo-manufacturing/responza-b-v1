import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import { findProfileByOrganizationId } from '../business/business.repository.js'
import { findConversationSendContext } from '../inbox/repositories/conversation.repository.js'
import { listRecentMessagesForConversation } from '../inbox/repositories/message.repository.js'
import { SUGGEST_REPLY_MESSAGE_LIMIT } from './ai.constants.js'
import {
  normalizeSuggestReplyResponse,
  translationLanguageSchema,
  type RewriteBody,
  type SuggestReplyBody,
  type TranslateBody,
} from './ai.schemas.js'
import {
  buildSuggestReplyTranscript,
  isLatestMessageOutbound,
  isTranslatableMessageContent,
} from './ai.utils.js'
import {
  buildSuggestReplySystemPrompt,
  buildSuggestReplyUserPrompt,
} from './prompts/suggestReply.prompt.js'
import { buildRewriteSystemPrompt } from './prompts/rewrite.prompt.js'
import { buildTranslateSystemPrompt } from './prompts/translate.prompt.js'
import { completeChat, completeChatJson } from './providers/openai.client.js'
import * as authRepository from '../auth/auth.repository.js'
import { findMessageByIdForOrganization } from '../inbox/repositories/message.repository.js'

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

export async function suggestReply(auth: AuthContext, input: SuggestReplyBody) {
  const conversation = await findConversationSendContext(auth.organizationId, input.conversationId)
  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const [profile, messages] = await Promise.all([
    findProfileByOrganizationId(auth.organizationId),
    listRecentMessagesForConversation({
      organization_id: auth.organizationId,
      conversation_id: input.conversationId,
      limit: SUGGEST_REPLY_MESSAGE_LIMIT,
    }),
  ])

  if (messages.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'No messages in this conversation yet')
  }

  const transcript = buildSuggestReplyTranscript(messages)
  const latestMessageIsOutbound = isLatestMessageOutbound(messages)
  const system = buildSuggestReplySystemPrompt(profile, latestMessageIsOutbound)
  const user = buildSuggestReplyUserPrompt(transcript)

  const raw = await completeChatJson({ system, user })

  let suggestions: string[]
  try {
    suggestions = normalizeSuggestReplyResponse(raw).suggestions
  } catch {
    throw new AppError(502, 'INTERNAL_ERROR', 'Could not generate reply suggestions. Please try again.')
  }

  return { suggestions }
}
