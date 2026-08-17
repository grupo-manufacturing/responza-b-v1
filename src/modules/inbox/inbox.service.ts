import { dispatchOutboundMessage } from '../../platforms/dispatchOutboundMessage.js'
import {
  enrichInstagramConversationList,
  enrichInstagramParticipantRecord,
} from '../../platforms/instagram/enrichment.js'
import { enqueueInboundMediaIngestionJob } from '../../shared/queue/index.js'
import type { AuthContext } from '../../shared/auth/index.js'
import { AppError, isAppError } from '../../shared/errors/index.js'
import { logger } from '../../shared/logger.js'
import { getInstagramCredentialsForOrganization } from '../integrations/credentials.service.js'
import {
  integrationPlatformFromApi,
  type IntegrationPlatform,
} from '../integrations/integrations.constants.js'
import {
  isMediaContentType,
  messageContentTypeToApi,
  messageDirectionToApi,
  messageStatusToApi,
  type ListInboxQuery,
  type GetConversationQuery,
  type MessageContentType,
  type SendMessageBody,
  type UploadOutboundMediaFields,
} from './inbox.schemas.js'
import {
  DEFAULT_CONVERSATION_LIST_LIMIT,
  MAX_CONVERSATION_LIST_LIMIT,
} from './conversation.pagination.js'
import {
  DEFAULT_MESSAGE_PAGE_SIZE,
  MAX_MESSAGE_PAGE_SIZE,
} from './message.pagination.js'
import * as inboxRepository from './inbox.repository.js'
import type {
  ConversationListRecord,
  ConversationRecord,
  MessageRecord,
  ParticipantRecord,
} from './inbox.repository.js'
import * as usageService from '../subscription/usage.service.js'
import {
  assertOutboundMediaStoragePath,
  resolveMessageMediaUrl,
  scheduleInboundMediaRepair,
  storeOutboundConversationMedia,
} from '../media/media.service.js'
import type { InboundMediaContentType } from '../media/media.constants.js'
import { messageMediaExists } from '../../shared/storage/index.js'
import {
  enqueueAgentDraftReplyJob,
  isAgentDraftReplyPlatform,
} from './agent-draft-reply.service.js'

export type ReceiveInboundMessageInput = {
  organizationId: string
  integrationId: string
  platform: IntegrationPlatform
  channelDisplayName: string
  conversationExternalId: string
  participant: {
    platformUserId: string
    displayName: string
    avatarUrl?: string | null
  }
  message: {
    platformMessageId: string
    content: string
    contentType?: MessageContentType
    media?: {
      platformMediaId?: string
      mediaUrl?: string
      mimeType?: string | null
      filename?: string | null
    }
  }
  accessToken?: string
}

export type ReceiveOutboundEchoInput = {
  organizationId: string
  integrationId: string
  platform: IntegrationPlatform
  channelDisplayName: string
  conversationExternalId: string
  participant: {
    platformUserId: string
    displayName: string
    avatarUrl?: string | null
  }
  message: {
    platformMessageId: string
    content: string
  }
}

type EnsureConversationInput = {
  organizationId: string
  integrationId: string
  platform: IntegrationPlatform
  channelDisplayName: string
  conversationExternalId: string
  participant: {
    platformUserId: string
    displayName: string
    avatarUrl?: string | null
  }
}

function isInboundMediaContentType(
  contentType: MessageContentType,
): contentType is InboundMediaContentType {
  return contentType !== 'text'
}

function scheduleAgentDraftReplyIfEligible(input: {
  organizationId: string
  platform: IntegrationPlatform
  conversationId: string
  messageId: string
  contentType: MessageContentType
  content: string
}): void {
  if (!isAgentDraftReplyPlatform(input.platform)) {
    return
  }

  if (input.contentType !== 'text') {
    return
  }

  const question = input.content.trim()
  if (question.length === 0) {
    return
  }

  void enqueueAgentDraftReplyJob({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    question,
  }).catch((error: unknown) => {
    logger.error(error instanceof Error ? error : new Error(String(error)))
  })
}

async function ensureConversationContext(input: EnsureConversationInput): Promise<{
  conversation: ConversationRecord
  participant: ParticipantRecord
  createdConversation: boolean
}> {
  let channel = await inboxRepository.findChannelByIntegration({
    organizationId: input.organizationId,
    integrationId: input.integrationId,
  })

  if (channel === null) {
    channel = await inboxRepository.insertChannel({
      organization_id: input.organizationId,
      integration_id: input.integrationId,
      platform: input.platform,
      display_name: input.channelDisplayName,
    })
  }

  let conversation = await inboxRepository.findConversationByExternalId({
    organizationId: input.organizationId,
    channelId: channel.id,
    externalId: input.conversationExternalId,
  })

  let createdConversation = false

  if (conversation === null) {
    await usageService.assertCanCreateConversation(input.organizationId)
    conversation = await inboxRepository.insertConversation({
      organization_id: input.organizationId,
      channel_id: channel.id,
      external_id: input.conversationExternalId,
    })
    createdConversation = true
    await usageService.recordBillableConversation(input.organizationId, conversation.id)
  }

  let participant = await inboxRepository.findParticipant({
    organizationId: input.organizationId,
    conversationId: conversation.id,
    platformUserId: input.participant.platformUserId,
  })

  if (participant === null) {
    participant = await inboxRepository.insertParticipant({
      organization_id: input.organizationId,
      conversation_id: conversation.id,
      platform_user_id: input.participant.platformUserId,
      display_name: input.participant.displayName,
      avatar_url: input.participant.avatarUrl ?? null,
    })
  }

  if (input.platform === 'instagram') {
    const credentials = await getInstagramCredentialsForOrganization(input.organizationId)
    if (credentials !== null) {
      void enrichInstagramParticipantRecord({
        organizationId: input.organizationId,
        participant,
        accessToken: credentials.accessToken,
      }).catch((error: unknown) => {
        logger.warn('[instagram] async participant enrichment failed', {
          organizationId: input.organizationId,
          participantId: participant.id,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }
  }

  return { conversation, participant, createdConversation }
}

export async function syncChannel(
  organizationId: string,
  integrationId: string,
  platform: IntegrationPlatform,
  displayName: string,
) {
  const existing = await inboxRepository.findChannelByIntegration({
    organizationId,
    integrationId,
  })

  if (existing !== null) {
    return existing
  }

  return inboxRepository.insertChannel({
    organization_id: organizationId,
    integration_id: integrationId,
    platform,
    display_name: displayName,
  })
}

function toConversationListItem(conversation: ConversationListRecord) {
  return {
    id: conversation.id,
    organizationId: conversation.organization_id,
    channelId: conversation.channel_id,
    platform: conversation.platform,
    channelDisplayName: conversation.channel_display_name,
    externalId: conversation.external_id,
    displayName: conversation.contact_display_name ?? conversation.external_id,
    avatarUrl: conversation.contact_avatar_url,
    lastMessage: conversation.last_message_content,
    lastMessageAt: conversation.last_message_at,
    createdAt: conversation.created_at,
  }
}

function toConversationResponse(conversation: ConversationRecord) {
  return {
    id: conversation.id,
    organizationId: conversation.organization_id,
    channelId: conversation.channel_id,
    externalId: conversation.external_id,
    lastMessageAt: conversation.last_message_at,
    createdAt: conversation.created_at,
  }
}

function toParticipantResponse(participant: ParticipantRecord) {
  return {
    id: participant.id,
    organizationId: participant.organization_id,
    conversationId: participant.conversation_id,
    platformUserId: participant.platform_user_id,
    displayName: participant.display_name,
    avatarUrl: participant.avatar_url,
    createdAt: participant.created_at,
  }
}

async function toMessageResponse(message: MessageRecord) {
  if (
    message.storage_path !== null &&
    message.direction === 'inbound' &&
    isInboundMediaContentType(message.content_type)
  ) {
    const storedObjectExists = await messageMediaExists(message.storage_path)
    if (!storedObjectExists) {
      void scheduleInboundMediaRepair(message).catch((error: unknown) => {
        logger.warn('Failed to schedule inbound media repair', {
          messageId: message.id,
          storagePath: message.storage_path,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }
  }

  const mediaUrl = await resolveMessageMediaUrl(message.storage_path, {
    contentType: message.content_type,
    mimeType: message.mime_type,
    content: message.content,
  })

  return {
    id: message.id,
    organizationId: message.organization_id,
    conversationId: message.conversation_id,
    participantId: message.participant_id,
    direction: messageDirectionToApi(message.direction),
    platformMessageId: message.platform_message_id,
    content: message.content,
    contentType: messageContentTypeToApi(message.content_type),
    mediaUrl,
    mimeType: message.mime_type,
    status: messageStatusToApi(message.status),
    suggestedReply: message.suggested_reply,
    createdAt: message.created_at,
  }
}

export async function listConversations(auth: AuthContext, query: ListInboxQuery) {
  const limit = Math.min(
    Math.max(1, query.limit ?? DEFAULT_CONVERSATION_LIST_LIMIT),
    MAX_CONVERSATION_LIST_LIMIT,
  )

  const result = await inboxRepository.listConversations({
    organizationId: auth.organizationId,
    platform:
      query.platform !== undefined ? integrationPlatformFromApi(query.platform) : undefined,
    limit,
    cursor: query.cursor,
  })

  const enrichedConversations = await enrichInstagramConversationList(
    auth.organizationId,
    result.conversations,
  )

  return {
    conversations: enrichedConversations.map(toConversationListItem),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  }
}

export async function getConversation(
  auth: AuthContext,
  conversationId: string,
  query: GetConversationQuery = {},
) {
  const conversation = await inboxRepository.findConversationSendContext(
    auth.organizationId,
    conversationId,
  )

  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const messageLimit = Math.min(
    Math.max(1, query.messageLimit ?? DEFAULT_MESSAGE_PAGE_SIZE),
    MAX_MESSAGE_PAGE_SIZE,
  )

  const [participants, messageResult] = await Promise.all([
    inboxRepository.listParticipantsByConversationId(auth.organizationId, conversationId),
    inboxRepository.listMessagesForConversation({
      organization_id: auth.organizationId,
      conversation_id: conversationId,
      limit: messageLimit,
      before: query.before,
    }),
  ])

  let enrichedParticipants = participants
  if (conversation.platform === 'instagram') {
    const credentials = await getInstagramCredentialsForOrganization(auth.organizationId)
    if (credentials !== null) {
      enrichedParticipants = await Promise.all(
        participants.map((participant) =>
          enrichInstagramParticipantRecord({
            organizationId: auth.organizationId,
            participant,
            accessToken: credentials.accessToken,
          }),
        ),
      )
    }
  }

  return {
    conversation: toConversationResponse(conversation),
    participants: enrichedParticipants.map(toParticipantResponse),
    messages: await Promise.all(messageResult.messages.map((message) => toMessageResponse(message))),
    messagesNextCursor: messageResult.nextCursor,
    hasMoreMessages: messageResult.hasMore,
  }
}

export async function uploadOutboundMedia(
  auth: AuthContext,
  conversationId: string,
  input: UploadOutboundMediaFields,
  file:
    | {
        buffer: Buffer
        mimetype: string
        originalname: string
      }
    | undefined,
) {
  const conversation = await inboxRepository.findConversationSendContext(
    auth.organizationId,
    conversationId,
  )

  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  if (file === undefined || file.buffer.byteLength === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media file is required')
  }

  const stored = await storeOutboundConversationMedia({
    organizationId: auth.organizationId,
    conversationId,
    contentType: input.contentType,
    buffer: file.buffer,
    mimeTypeHint: file.mimetype,
    filename: input.filename ?? file.originalname,
  })

  return {
    media: {
      storagePath: stored.storagePath,
      mimeType: stored.mimeType,
      fileSizeBytes: stored.fileSizeBytes,
      filename: input.filename ?? file.originalname ?? null,
    },
  }
}

export async function sendMessage(
  auth: AuthContext,
  conversationId: string,
  input: SendMessageBody,
) {
  const conversation = await inboxRepository.findConversationSendContext(
    auth.organizationId,
    conversationId,
  )

  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const contentType: MessageContentType = input.contentType ?? 'text'
  const content = input.content ?? ''

  if (isMediaContentType(contentType)) {
    if (input.storagePath === undefined || input.mimeType === undefined) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Media attachment metadata is required')
    }

    assertOutboundMediaStoragePath({
      organizationId: auth.organizationId,
      conversationId,
      storagePath: input.storagePath,
    })

    const mediaExists = await messageMediaExists(input.storagePath)
    if (!mediaExists) {
      throw new AppError(404, 'NOT_FOUND', 'Uploaded media was not found')
    }
  }

  const message = await inboxRepository.insertOutboundMessage({
    organization_id: auth.organizationId,
    conversation_id: conversationId,
    content,
    content_type: contentType,
    storage_path: isMediaContentType(contentType) ? (input.storagePath ?? null) : null,
    mime_type: isMediaContentType(contentType) ? (input.mimeType ?? null) : null,
    file_size_bytes: isMediaContentType(contentType) ? (input.fileSizeBytes ?? null) : null,
  })

  await usageService.recordBillableConversation(auth.organizationId, conversationId)

  try {
    const delivery = await dispatchOutboundMessage({
      platform: conversation.platform,
      organizationId: auth.organizationId,
      integrationId: conversation.integration_id,
      recipientExternalId: conversation.external_id,
      content,
      contentType,
      media: isMediaContentType(contentType)
        ? {
            storagePath: input.storagePath!,
            mimeType: input.mimeType!,
            filename: input.filename ?? null,
          }
        : undefined,
    })

    const updated = await inboxRepository.updateMessageDeliveryStatus({
      organization_id: auth.organizationId,
      message_id: message.id,
      status: 'sent',
      platform_message_id: delivery.platformMessageId,
      platform_media_id: delivery.platformMediaId ?? null,
    })

    return {
      message: await toMessageResponse(updated),
    }
  } catch (error) {
    const updated = await inboxRepository.updateMessageDeliveryStatus({
      organization_id: auth.organizationId,
      message_id: message.id,
      status: 'failed',
      platform_message_id: null,
      platform_media_id: null,
    })

    if (isAppError(error)) {
      throw new AppError(error.statusCode, error.code, error.message, {
        message: await toMessageResponse(updated),
      })
    }

    throw error
  }
}

export async function markOutboundMessageRead(input: {
  organizationId: string
  platformMessageId: string
}) {
  return inboxRepository.markOutboundMessageReadByPlatformId({
    organization_id: input.organizationId,
    platform_message_id: input.platformMessageId,
  })
}

export async function receiveInboundMessage(input: ReceiveInboundMessageInput) {
  const { conversation, participant, createdConversation } = await ensureConversationContext(input)

  const contentType: MessageContentType = input.message.contentType ?? 'text'
  let content = input.message.content
  let storagePath: string | null = null
  let mimeType: string | null = null
  let platformMediaId: string | null = null
  let fileSizeBytes: number | null = null
  let pendingMediaIngestion:
    | {
        platform: Extract<IntegrationPlatform, 'whatsapp' | 'instagram'>
        contentType: InboundMediaContentType
        platformMediaId?: string
        mediaUrl?: string
        mimeTypeHint: string | null
        filename?: string | null
      }
    | null = null

  if (
    isInboundMediaContentType(contentType) &&
    input.message.media !== undefined &&
    input.accessToken !== undefined
  ) {
    if (input.platform === 'whatsapp' && input.message.media.platformMediaId !== undefined) {
      platformMediaId = input.message.media.platformMediaId
      pendingMediaIngestion = {
        platform: 'whatsapp',
        contentType,
        platformMediaId: input.message.media.platformMediaId,
        mimeTypeHint: input.message.media.mimeType ?? null,
        filename: input.message.media.filename ?? null,
      }
    } else if (input.platform === 'instagram' && input.message.media.mediaUrl !== undefined) {
      platformMediaId = input.message.media.mediaUrl
      pendingMediaIngestion = {
        platform: 'instagram',
        contentType,
        mediaUrl: input.message.media.mediaUrl,
        mimeTypeHint: input.message.media.mimeType ?? null,
        filename: input.message.media.filename ?? null,
      }
    } else if (content.trim().length === 0 && input.message.media.filename?.trim()) {
      content = input.message.media.filename.trim()
    }
  }

  const message = await inboxRepository.insertInboundMessage({
    organization_id: input.organizationId,
    conversation_id: conversation.id,
    participant_id: participant.id,
    platform_message_id: input.message.platformMessageId,
    content,
    content_type: contentType,
    storage_path: storagePath,
    mime_type: mimeType,
    platform_media_id: platformMediaId,
    file_size_bytes: fileSizeBytes,
  })

  if (message === null) {
    const existingMessages = await inboxRepository.listMessagesByConversationId(
      input.organizationId,
      conversation.id,
    )

    const duplicate = existingMessages.find(
      (item) => item.platform_message_id === input.message.platformMessageId,
    )

    if (duplicate === undefined) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to receive message')
    }

    if (
      duplicate.storage_path === null &&
      pendingMediaIngestion !== null &&
      input.accessToken !== undefined
    ) {
      await enqueueInboundMediaIngestionJob({
        organizationId: input.organizationId,
        conversationId: conversation.id,
        messageId: duplicate.id,
        platform: pendingMediaIngestion.platform,
        contentType: pendingMediaIngestion.contentType,
        platformMessageId: input.message.platformMessageId,
        accessToken: input.accessToken,
        platformMediaId: pendingMediaIngestion.platformMediaId,
        mediaUrl: pendingMediaIngestion.mediaUrl,
        mimeTypeHint: pendingMediaIngestion.mimeTypeHint,
        filename: pendingMediaIngestion.filename ?? null,
      })
    }

    return {
      conversation: toConversationResponse(conversation),
      participant: toParticipantResponse(participant),
      message: await toMessageResponse(duplicate),
      duplicate: true,
    }
  }

  if (!createdConversation) {
    await usageService.recordBillableConversation(input.organizationId, conversation.id)
  }

  if (message !== null && pendingMediaIngestion !== null && input.accessToken !== undefined) {
    await enqueueInboundMediaIngestionJob({
      organizationId: input.organizationId,
      conversationId: conversation.id,
      messageId: message.id,
      platform: pendingMediaIngestion.platform,
      contentType: pendingMediaIngestion.contentType,
      platformMessageId: input.message.platformMessageId,
      accessToken: input.accessToken,
      platformMediaId: pendingMediaIngestion.platformMediaId,
      mediaUrl: pendingMediaIngestion.mediaUrl,
      mimeTypeHint: pendingMediaIngestion.mimeTypeHint,
      filename: pendingMediaIngestion.filename ?? null,
    })
  }

  scheduleAgentDraftReplyIfEligible({
    organizationId: input.organizationId,
    platform: input.platform,
    conversationId: conversation.id,
    messageId: message.id,
    contentType,
    content,
  })

  return {
    conversation: toConversationResponse(conversation),
    participant: toParticipantResponse(participant),
    message: await toMessageResponse(message),
    duplicate: false,
  }
}

export async function receiveOutboundEcho(input: ReceiveOutboundEchoInput) {
  const { conversation, participant, createdConversation } = await ensureConversationContext(input)

  const message = await inboxRepository.insertOutboundEchoMessage({
    organization_id: input.organizationId,
    conversation_id: conversation.id,
    platform_message_id: input.message.platformMessageId,
    content: input.message.content,
  })

  if (message === null) {
    const existing = await inboxRepository.findMessageByPlatformMessageId({
      organization_id: input.organizationId,
      conversation_id: conversation.id,
      platform_message_id: input.message.platformMessageId,
    })

    if (existing === null) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to receive outbound echo')
    }

    return {
      conversation: toConversationResponse(conversation),
      participant: toParticipantResponse(participant),
      message: await toMessageResponse(existing),
      duplicate: true,
    }
  }

  if (!createdConversation) {
    await usageService.recordBillableConversation(input.organizationId, conversation.id)
  }

  return {
    conversation: toConversationResponse(conversation),
    participant: toParticipantResponse(participant),
    message: await toMessageResponse(message),
    duplicate: false,
  }
}
