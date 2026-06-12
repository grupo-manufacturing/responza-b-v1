import { dispatchOutboundMessage } from '../../platforms/dispatchOutboundMessage.js'
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
  messageDirectionToApi,
  messageStatusToApi,
  type ListInboxQuery,
  type SendMessageBody,
} from './inbox.schemas.js'
import * as inboxRepository from './inbox.repository.js'
import type {
  ConversationListRecord,
  ConversationRecord,
  MessageRecord,
  ParticipantRecord,
} from './inbox.repository.js'

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
  }
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

function toMessageResponse(message: MessageRecord) {
  return {
    id: message.id,
    organizationId: message.organization_id,
    conversationId: message.conversation_id,
    participantId: message.participant_id,
    direction: messageDirectionToApi(message.direction),
    platformMessageId: message.platform_message_id,
    content: message.content,
    status: messageStatusToApi(message.status),
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
    messages: messages.map(toMessageResponse),
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
      message: toMessageResponse(updated),
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
        message: toMessageResponse(updated),
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

  if (conversation === null) {
    conversation = await inboxRepository.insertConversation({
      organization_id: input.organizationId,
      channel_id: channel.id,
      external_id: input.conversationExternalId,
    })
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

  const message = await inboxRepository.insertInboundMessage({
    organization_id: input.organizationId,
    conversation_id: conversation.id,
    participant_id: participant.id,
    platform_message_id: input.message.platformMessageId,
    content: input.message.content,
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
      message: toMessageResponse(duplicate),
      duplicate: true,
    }
  }

  return {
    conversation: toConversationResponse(conversation),
    participant: toParticipantResponse(participant),
    message: toMessageResponse(message),
    duplicate: false,
  }
}
