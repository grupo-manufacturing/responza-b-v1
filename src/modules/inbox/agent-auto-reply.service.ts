import { dispatchOutboundMessage } from '../../platforms/dispatchOutboundMessage.js'
import { loadEnv } from '../../shared/config/index.js'
import { logger } from '../../shared/logger.js'
import { enqueueAiJob, type AgentAutoReplyPayload } from '../../shared/queue/ai.queue.js'
import { askBusinessAgent } from '../knowledge/ask/ask.service.js'
import { countDocumentChunksByOrganizationId } from '../knowledge/repositories/document-chunk.repository.js'
import * as usageService from '../subscription/usage.service.js'
import * as inboxRepository from './inbox.repository.js'

export type { AgentAutoReplyPayload } from '../../shared/queue/ai.queue.js'

export function isAgentAutoReplyPlatform(
  platform: string,
): platform is 'whatsapp' | 'instagram' {
  return platform === 'whatsapp' || platform === 'instagram'
}

export async function enqueueAgentAutoReplyJob(
  payload: AgentAutoReplyPayload,
): Promise<void> {
  const env = loadEnv()
  if (!env.AI_ENABLED) {
    return
  }

  await enqueueAiJob({
    jobId: payload.messageId,
    organizationId: payload.organizationId,
    type: 'agent-auto-reply',
    payload,
  })
}

async function sendAgentAutoReply(input: {
  organizationId: string
  conversationId: string
  triggerMessageId: string
  content: string
}): Promise<boolean> {
  const existingReply = await inboxRepository.findAgentReplyForInboundMessage({
    organization_id: input.organizationId,
    trigger_message_id: input.triggerMessageId,
  })

  if (existingReply !== null) {
    return false
  }

  const conversation = await inboxRepository.findConversationSendContext(
    input.organizationId,
    input.conversationId,
  )

  if (conversation === null) {
    return false
  }

  const message = await inboxRepository.insertOutboundMessage({
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    content: input.content,
    content_type: 'text',
    send_source: 'agent',
    trigger_message_id: input.triggerMessageId,
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

    await inboxRepository.updateMessageDeliveryStatus({
      organization_id: input.organizationId,
      message_id: message.id,
      status: 'sent',
      platform_message_id: delivery.platformMessageId,
      platform_media_id: delivery.platformMediaId ?? null,
    })

    return true
  } catch (error) {
    await inboxRepository.updateMessageDeliveryStatus({
      organization_id: input.organizationId,
      message_id: message.id,
      status: 'failed',
      platform_message_id: null,
      platform_media_id: null,
    })

    logger.error(error instanceof Error ? error : new Error(String(error)))
    throw error
  }
}

export async function runAgentAutoReply(payload: AgentAutoReplyPayload): Promise<void> {
  const env = loadEnv()
  if (!env.AI_ENABLED) {
    return
  }

  const chunkCount = await countDocumentChunksByOrganizationId(payload.organizationId)
  if (chunkCount === 0) {
    return
  }

  const result = await askBusinessAgent(payload.organizationId, payload.question)
  if (result.is_fallback || result.answer.trim().length === 0) {
    return
  }

  const sent = await sendAgentAutoReply({
    organizationId: payload.organizationId,
    conversationId: payload.conversationId,
    triggerMessageId: payload.messageId,
    content: result.answer.trim(),
  })

  if (!sent) {
    return
  }

  logger.info(
    `Agent auto-reply sent for inbound message ${payload.messageId} in organization ${payload.organizationId}`,
  )
}
