import type { AuthContext } from '../../shared/auth/index.js'
import { createWhatsAppConnector } from '../../connectors/whatsapp/index.js'
import { AppError } from '../../shared/errors/index.js'
import { getLogger } from '../../shared/logger/index.js'
import * as integrationsRepository from '../integrations/integrations.repository.js'
import { syncChannelsFromConnectedIntegrations } from './channels.service.js'
import type { InboxPlatform } from './inbox.constants.js'
import {
  messageContentTypeFromApi,
  messageContentTypeToApi,
  messageDirectionToApi,
  messageStatusToApi,
} from './inbox.constants.js'
import type { CreateMessageBody, ListInboxQuery, ListMessagesQuery } from './inbox.schemas.js'
import * as inboxRepository from './inbox.repository.js'
import type {
  ChannelRecord,
  ConversationRecord,
  MessageRecord,
  ParticipantRecord,
} from './inbox.repository.js'

function toParticipantResponse(participant: ParticipantRecord) {
  return {
    id: participant.id,
    conversationId: participant.conversation_id,
    platformUserId: participant.platform_user_id,
    displayName: participant.display_name,
    avatarUrl: participant.avatar_url,
    metadata: participant.metadata,
    firstMessageAt: participant.first_message_at,
    lastMessageAt: participant.last_message_at,
    createdAt: participant.created_at,
    updatedAt: participant.updated_at,
  }
}

function toMessageResponse(message: MessageRecord) {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    participantId: message.participant_id,
    direction: messageDirectionToApi(message.direction),
    platformMessageId: message.platform_message_id,
    contentType: messageContentTypeToApi(message.content_type),
    body: message.body,
    fileUrl: message.file_url,
    metadata: message.metadata,
    status: messageStatusToApi(message.status),
    createdAt: message.created_at,
    updatedAt: message.updated_at,
  }
}

function toMessageSnippet(message: MessageRecord | null) {
  if (message === null) {
    return null
  }

  return {
    id: message.id,
    direction: messageDirectionToApi(message.direction),
    contentType: messageContentTypeToApi(message.content_type),
    body: message.body,
    status: messageStatusToApi(message.status),
    createdAt: message.created_at,
  }
}

async function toConversationResponse(
  conversation: ConversationRecord,
  channel: ChannelRecord | undefined,
  options: { includeParticipants?: boolean; includeLatestMessage?: boolean } = {},
) {
  const [participants, latestMessage] = await Promise.all([
    options.includeParticipants === true
      ? inboxRepository.listParticipantsByConversation(conversation.id)
      : Promise.resolve([]),
    options.includeLatestMessage === true
      ? inboxRepository.findLatestMessageByConversation(conversation.id)
      : Promise.resolve(null),
  ])

  return {
    id: conversation.id,
    organizationId: conversation.organization_id,
    channelId: conversation.channel_id,
    platform: channel?.platform ?? null,
    externalId: conversation.external_id,
    lastMessageAt: conversation.last_message_at,
    unreadCount: conversation.unread_count,
    metadata: conversation.metadata,
    createdAt: conversation.created_at,
    updatedAt: conversation.updated_at,
    participants:
      options.includeParticipants === true ? participants.map(toParticipantResponse) : undefined,
    latestMessage:
      options.includeLatestMessage === true ? toMessageSnippet(latestMessage) : undefined,
  }
}

function channelIdsForPlatform(channels: ChannelRecord[], platform?: InboxPlatform): string[] | undefined {
  if (platform === undefined) {
    return undefined
  }

  return channels.filter((channel) => channel.platform === platform).map((channel) => channel.id)
}

export async function listInbox(auth: AuthContext, query: ListInboxQuery) {
  await syncChannelsFromConnectedIntegrations(auth.organizationId)

  const channels = await inboxRepository.listChannelsByOrganization(auth.organizationId)
  const channelById = new Map(channels.map((channel) => [channel.id, channel]))

  const result = await inboxRepository.listConversations({
    organizationId: auth.organizationId,
    limit: query.limit,
    cursor: query.cursor,
    platform: query.platform,
    channelIds: channelIdsForPlatform(channels, query.platform),
  })

  const conversations = await Promise.all(
    result.conversations.map((conversation) =>
      toConversationResponse(conversation, channelById.get(conversation.channel_id), {
        includeLatestMessage: true,
      }),
    ),
  )

  return {
    conversations,
    page: {
      nextCursor: result.nextCursor,
      limit: query.limit,
    },
  }
}

export async function getConversation(auth: AuthContext, conversationId: string) {
  const conversation = await inboxRepository.findConversationById(
    auth.organizationId,
    conversationId,
  )

  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const channel = await inboxRepository.findChannelById(
    auth.organizationId,
    conversation.channel_id,
  )

  return {
    conversation: await toConversationResponse(conversation, channel ?? undefined, {
      includeParticipants: true,
      includeLatestMessage: true,
    }),
  }
}

export async function listConversationMessages(
  auth: AuthContext,
  conversationId: string,
  query: ListMessagesQuery,
) {
  const conversation = await inboxRepository.findConversationById(
    auth.organizationId,
    conversationId,
  )

  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const result = await inboxRepository.listMessages({
    conversationId,
    limit: query.limit,
    cursor: query.cursor,
    direction: query.direction,
  })

  return {
    messages: result.messages.map(toMessageResponse),
    page: {
      nextCursor: result.nextCursor,
      limit: query.limit,
    },
  }
}

export async function createOutboundMessage(
  auth: AuthContext,
  conversationId: string,
  input: CreateMessageBody,
) {
  const conversation = await inboxRepository.findConversationById(
    auth.organizationId,
    conversationId,
  )

  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const participant = await inboxRepository.findPrimaryParticipant(conversationId)
  if (participant === null) {
    throw new AppError(409, 'CONFLICT', 'Conversation has no participant')
  }

  const contentType = messageContentTypeFromApi(input.contentType)

  const channel = await inboxRepository.findChannelById(auth.organizationId, conversation.channel_id)
  if (channel === null) {
    throw new AppError(409, 'CONFLICT', 'Conversation channel is missing')
  }

  const message = await inboxRepository.insertMessage({
    conversation_id: conversationId,
    participant_id: participant.id,
    direction: 'outbound',
    content_type: contentType,
    body: input.body ?? null,
    file_url: input.fileUrl ?? null,
    status: 'pending',
  })

  await inboxRepository.touchConversationAfterMessage(
    auth.organizationId,
    conversationId,
    message.created_at,
  )

  if (channel.platform === 'whatsapp') {
    const integration = await integrationsRepository.findIntegrationByPlatform(
      auth.organizationId,
      'whatsapp',
    )

    const accessToken = integration?.access_token?.trim() ?? ''
    const phoneNumberId =
      typeof integration?.metadata.phone_number_id === 'string'
        ? integration.metadata.phone_number_id
        : ''

    if (
      integration === null ||
      integration.status !== 'connected' ||
      accessToken.length === 0 ||
      phoneNumberId.length === 0
    ) {
      await inboxRepository.updateMessageStatus(message.id, 'failed')
      throw new AppError(409, 'CONFLICT', 'WhatsApp is not connected for this organization')
    }

    const connector = createWhatsAppConnector({
      accessToken,
      phoneNumberId,
    })

    try {
      const result = await connector.sendMessage({
        externalConversationId: participant.platform_user_id,
        contentType: 'text',
        body: input.body ?? null,
        fileUrl: null,
      })

      const delivered = await inboxRepository.updateMessageStatus(message.id, 'sent', {
        platformMessageId: result.platformMessageId,
      })

      return { message: toMessageResponse(delivered) }
    } catch (error) {
      await inboxRepository.updateMessageStatus(message.id, 'failed')
      getLogger().warn(
        {
          organizationId: auth.organizationId,
          conversationId,
          messageId: message.id,
          err: error,
        },
        'WhatsApp outbound send failed',
      )

      if (error instanceof AppError) {
        throw error
      }

      throw new AppError(502, 'UPSTREAM_ERROR', 'Failed to send WhatsApp message')
    }
  }

  const delivered = await inboxRepository.updateMessageStatus(message.id, 'sent')

  return { message: toMessageResponse(delivered) }
}
