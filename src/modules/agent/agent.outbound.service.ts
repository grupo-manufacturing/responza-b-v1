import { dispatchOutboundMessage } from '../../platforms/dispatchOutboundMessage.js'
import { AppError } from '../../shared/errors/index.js'
import * as inboxRepository from '../inbox/inbox.repository.js'
import * as usageService from '../subscription/usage.service.js'

export async function sendAgentReply(input: {
  organizationId: string
  conversationId: string
  content: string
}): Promise<{ messageId: string }> {
  const conversation = await inboxRepository.findConversationSendContext(
    input.organizationId,
    input.conversationId,
  )

  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const trimmed = input.content.trim()
  if (trimmed.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Agent reply cannot be empty')
  }

  const message = await inboxRepository.insertOutboundMessage({
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    content: trimmed,
    content_type: 'text',
    send_source: 'agent',
  })

  await usageService.recordBillableConversation(input.organizationId, input.conversationId)

  try {
    const delivery = await dispatchOutboundMessage({
      platform: conversation.platform,
      organizationId: input.organizationId,
      integrationId: conversation.integration_id,
      recipientExternalId: conversation.external_id,
      content: trimmed,
      contentType: 'text',
    })

    await inboxRepository.updateMessageDeliveryStatus({
      organization_id: input.organizationId,
      message_id: message.id,
      status: 'sent',
      platform_message_id: delivery.platformMessageId,
      platform_media_id: delivery.platformMediaId ?? null,
    })

    return { messageId: message.id }
  } catch (error) {
    await inboxRepository.updateMessageDeliveryStatus({
      organization_id: input.organizationId,
      message_id: message.id,
      status: 'failed',
      platform_message_id: null,
      platform_media_id: null,
    })

    throw error
  }
}
