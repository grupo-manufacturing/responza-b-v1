import { dispatchOutboundMessage } from '../../platforms/dispatchOutboundMessage.js'
import { dispatchOutboundReaction } from '../../platforms/dispatchOutboundReaction.js'
import {
  enrichInstagramConversationList,
  enrichInstagramParticipantRecord,
} from '../../platforms/instagram/enrichment.js'
import type { AuthContext } from '../../shared/auth/index.js'
import { AppError, isAppError } from '../../shared/errors/index.js'
import { getInstagramCredentialsForOrganization } from '../integrations/credentials.service.js'
import {
  integrationPlatformFromApi,
  integrationPlatformToApi,
  type IntegrationPlatform,
} from '../integrations/integrations.constants.js'
import {
  isAllowedReactionEmoji,
  messageContentTypeToApi,
  messageDirectionToApi,
  messageStatusToApi,
  type ListInboxQuery,
  type MessageContentType,
  type ReactToMessageBody,
  type SendMessageBody,
} from './inbox.schemas.js'
import * as inboxRepository from './inbox.repository.js'
import type {
  ConversationListRecord,
  ConversationRecord,
  MessageRecord,
  ParticipantRecord,
} from './inbox.repository.js'
import * as usageService from '../subscription/usage.service.js'
import { storeInboundInstagramMedia, storeInboundWhatsAppMedia, resolveMessageMediaUrl } from '../media/media.service.js'
import type { InboundMediaContentType } from '../media/media.constants.js'

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
      participant = await enrichInstagramParticipantRecord({
        organizationId: input.organizationId,
        participant,
        accessToken: credentials.accessToken,
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
    platform: integrationPlatformToApi(conversation.platform),
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
    customerReaction: message.customer_reaction,
    agentReaction: message.agent_reaction,
    createdAt: message.created_at,
  }
}

export async function listConversations(auth: AuthContext, query: ListInboxQuery) {
  const conversations = await inboxRepository.listConversations({
    organizationId: auth.organizationId,
    platform:
      query.platform !== undefined ? integrationPlatformFromApi(query.platform) : undefined,
  })

  const enrichedConversations = await enrichInstagramConversationList(
    auth.organizationId,
    conversations,
  )

  return {
    conversations: enrichedConversations.map(toConversationListItem),
  }
}

export async function getConversation(auth: AuthContext, conversationId: string) {
  const conversation = await inboxRepository.findConversationSendContext(
    auth.organizationId,
    conversationId,
  )

  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const [participants, messages] = await Promise.all([
    inboxRepository.listParticipantsByConversationId(auth.organizationId, conversationId),
    inboxRepository.listMessagesByConversationId(auth.organizationId, conversationId),
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
    messages: await Promise.all(messages.map((message) => toMessageResponse(message))),
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

  const message = await inboxRepository.insertOutboundMessage({
    organization_id: auth.organizationId,
    conversation_id: conversationId,
    content: input.content,
  })

  await usageService.recordBillableConversation(auth.organizationId, conversationId)

  try {
    const delivery = await dispatchOutboundMessage({
      platform: conversation.platform,
      organizationId: auth.organizationId,
      integrationId: conversation.integration_id,
      recipientExternalId: conversation.external_id,
      content: input.content,
    })

    const updated = await inboxRepository.updateMessageDeliveryStatus({
      organization_id: auth.organizationId,
      message_id: message.id,
      status: 'sent',
      platform_message_id: delivery.platformMessageId,
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

export async function applyCustomerReaction(input: {
  organizationId: string
  platformMessageId: string
  emoji: string | null
}) {
  if (input.emoji !== null && !isAllowedReactionEmoji(input.emoji)) {
    return null
  }

  return inboxRepository.updateCustomerReactionByPlatformMessageId({
    organization_id: input.organizationId,
    platform_message_id: input.platformMessageId,
    emoji: input.emoji,
  })
}

export async function reactToMessage(
  auth: AuthContext,
  conversationId: string,
  messageId: string,
  input: ReactToMessageBody,
) {
  const conversation = await inboxRepository.findConversationSendContext(
    auth.organizationId,
    conversationId,
  )

  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const message = await inboxRepository.findMessageById({
    organization_id: auth.organizationId,
    conversation_id: conversationId,
    message_id: messageId,
  })

  if (message === null) {
    throw new AppError(404, 'NOT_FOUND', 'Message not found')
  }

  if (message.direction !== 'inbound') {
    throw new AppError(400, 'BAD_REQUEST', 'You can only react to customer messages')
  }

  if (message.platform_message_id === null) {
    throw new AppError(400, 'BAD_REQUEST', 'Message is not ready for reactions')
  }

  if (conversation.platform === 'indiamart') {
    throw new AppError(400, 'BAD_REQUEST', 'Reactions are not supported for this platform')
  }

  await dispatchOutboundReaction({
    platform: conversation.platform,
    organizationId: auth.organizationId,
    integrationId: conversation.integration_id,
    recipientExternalId: conversation.external_id,
    targetPlatformMessageId: message.platform_message_id,
    emoji: input.emoji,
  })

  const updated = await inboxRepository.updateAgentReaction({
    organization_id: auth.organizationId,
    message_id: messageId,
    emoji: input.emoji,
  })

  return {
    message: await toMessageResponse(updated),
  }
}

export async function receiveInboundMessage(input: ReceiveInboundMessageInput) {
  const { conversation, participant, createdConversation } = await ensureConversationContext(input)

  let contentType: MessageContentType = input.message.contentType ?? 'text'
  let content = input.message.content
  let storagePath: string | null = null
  let mimeType: string | null = null
  let platformMediaId: string | null = null
  let fileSizeBytes: number | null = null

  if (
    isInboundMediaContentType(contentType) &&
    input.message.media !== undefined &&
    input.accessToken !== undefined
  ) {
    const stored =
      input.platform === 'whatsapp' && input.message.media.platformMediaId !== undefined
        ? await storeInboundWhatsAppMedia({
            contentType,
            organizationId: input.organizationId,
            conversationId: conversation.id,
            platformMessageId: input.message.platformMessageId,
            platformMediaId: input.message.media.platformMediaId,
            mimeTypeHint: input.message.media.mimeType ?? null,
            filename: input.message.media.filename ?? null,
            accessToken: input.accessToken,
          })
        : input.platform === 'instagram' && input.message.media.mediaUrl !== undefined
          ? await storeInboundInstagramMedia({
              contentType,
              organizationId: input.organizationId,
              conversationId: conversation.id,
              platformMessageId: input.message.platformMessageId,
              mediaUrl: input.message.media.mediaUrl,
              mimeTypeHint: input.message.media.mimeType ?? null,
              filename: input.message.media.filename ?? null,
              accessToken: input.accessToken,
            })
          : null

    if (stored !== null) {
      storagePath = stored.storagePath
      mimeType = stored.mimeType
      platformMediaId =
        input.message.media.platformMediaId ?? input.message.media.mediaUrl ?? null
      fileSizeBytes = stored.fileSizeBytes
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
