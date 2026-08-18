import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import { findProfileByOrganizationId } from '../business/business.repository.js'
import { findConversationSendContext } from '../inbox/repositories/conversation.repository.js'
import {
  findMessageByIdForOrganization,
  listMessagesByConversationId,
} from '../inbox/repositories/message.repository.js'
import { ANALYTICS_MIN_MESSAGES } from './ai.constants.js'
import {
  normalizeConversationAnalyticsResponse,
  translationLanguageSchema,
  type ConversationAnalyticsBody,
  type TranslateBody,
} from './ai.schemas.js'
import { buildAnalyticsTranscript, isTranslatableMessageContent } from './ai.utils.js'
import {
  buildConversationAnalyticsSystemPrompt,
  buildConversationAnalyticsUserPrompt,
} from './prompts/conversationAnalytics.prompt.js'
import { buildTranslateSystemPrompt } from './prompts/translate.prompt.js'
import { completeChat, completeChatJson } from './providers/openai.client.js'
import * as authRepository from '../auth/auth.repository.js'

async function resolveTranslateContext(auth: AuthContext, input: TranslateBody) {
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

  return { targetLanguage: parsedTargetLanguage.data, message }
}

export async function validateTranslateMessage(
  auth: AuthContext,
  input: TranslateBody,
): Promise<void> {
  await resolveTranslateContext(auth, input)
}

export async function translateMessage(auth: AuthContext, input: TranslateBody) {
  const { targetLanguage, message } = await resolveTranslateContext(auth, input)

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

export async function validateAnalyzeConversation(
  auth: AuthContext,
  input: ConversationAnalyticsBody,
): Promise<void> {
  const conversation = await findConversationSendContext(auth.organizationId, input.conversationId)
  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const messages = await listMessagesByConversationId(auth.organizationId, input.conversationId)

  if (messages.length < ANALYTICS_MIN_MESSAGES) {
    throw new AppError(400, 'BAD_REQUEST', 'No messages in this conversation yet')
  }
}

export async function analyzeConversation(auth: AuthContext, input: ConversationAnalyticsBody) {
  const conversation = await findConversationSendContext(auth.organizationId, input.conversationId)
  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const [profile, messages] = await Promise.all([
    findProfileByOrganizationId(auth.organizationId),
    listMessagesByConversationId(auth.organizationId, input.conversationId),
  ])

  if (messages.length < ANALYTICS_MIN_MESSAGES) {
    throw new AppError(400, 'BAD_REQUEST', 'No messages in this conversation yet')
  }

  const { transcript, omittedOlderMessageCount } = buildAnalyticsTranscript(messages)
  const system = buildConversationAnalyticsSystemPrompt(profile)
  const user = buildConversationAnalyticsUserPrompt({ transcript, omittedOlderMessageCount })

  const raw = await completeChatJson({ system, user })

  try {
    return normalizeConversationAnalyticsResponse(raw)
  } catch {
    throw new AppError(
      502,
      'INTERNAL_ERROR',
      'Could not generate conversation analytics. Please try again.',
    )
  }
}
