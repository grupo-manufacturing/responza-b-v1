import { dispatchOutboundMessage } from '../../platforms/dispatchOutboundMessage.js'
import { AppError, isAppError } from '../../shared/errors/index.js'
import { findConversationSendContext } from '../inbox/repositories/conversation.repository.js'
import {
  insertOutboundMessage,
  updateMessageDeliveryStatus,
} from '../inbox/repositories/message.repository.js'
import type { MessageRecord } from '../inbox/repositories/types.js'
import * as usageService from '../subscription/usage.service.js'

export async function sendAgentTextReply(input: {
  organizationId: string
  conversationId: string
  content: string
}): Promise<MessageRecord> {
  const conversation = await findConversationSendContext(input.organizationId, input.conversationId)
  if (conversation === null) {
    throw new AppError(404, 'NOT_FOUND', 'Conversation not found')
  }

  const message = await insertOutboundMessage({
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    content: input.content,
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
      content: input.content,
      contentType: 'text',
    })

    return updateMessageDeliveryStatus({
      organization_id: input.organizationId,
      message_id: message.id,
      status: 'sent',
      platform_message_id: delivery.platformMessageId,
      platform_media_id: delivery.platformMediaId ?? null,
    })
  } catch (error) {
    await updateMessageDeliveryStatus({
      organization_id: input.organizationId,
      message_id: message.id,
      status: 'failed',
      platform_message_id: null,
      platform_media_id: null,
    })

    if (isAppError(error)) {
      throw error
    }

    throw new AppError(502, 'INTERNAL_ERROR', 'Failed to send agent reply')
  }
}
