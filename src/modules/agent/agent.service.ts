import { loadEnv } from '../../shared/config/index.js'
import { isOpenAiConfigured } from '../ai/providers/openai.client.js'
import { buildSuggestReplyTranscript } from '../ai/ai.utils.js'
import { SUGGEST_REPLY_MESSAGE_LIMIT } from '../ai/ai.constants.js'
import { listMessagesByConversationId } from '../inbox/repositories/message.repository.js'
import { getSubscriptionForOrganization } from '../subscription/subscription.service.js'
import { logger } from '../../shared/logger.js'
import { isWithinBusinessHours } from './agent.business-hours.js'
import { runAgentGate } from './agent.gate.js'
import { passesAgentPolicies } from './agent.policies.js'
import { generateAgentReply } from './agent.reply.js'
import { formatRetrievedContext, retrieveAgentContext } from './agent.retrieve.js'
import * as agentRepository from './agent.repository.js'
import { sendAgentTextReply } from './agent.send.js'

export type AgentEvaluateJobData = {
  organizationId: string
  conversationId: string
  messageId: string
}

async function recordSkip(
  input: AgentEvaluateJobData,
  reason: string,
  extra?: {
    confidence?: number | null
    gateResult?: Record<string, unknown> | null
  },
): Promise<void> {
  await agentRepository.insertAgentDecision({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    action: 'skip',
    reason,
    confidence: extra?.confidence ?? null,
    gateResult: extra?.gateResult ?? null,
  })
}

function hasHumanReplyAfterInbound(
  messages: Awaited<ReturnType<typeof listMessagesByConversationId>>,
  inboundMessageId: string,
): boolean {
  const inbound = messages.find((message) => message.id === inboundMessageId)
  if (inbound === undefined) {
    return false
  }

  return messages.some(
    (message) =>
      message.direction === 'outbound' &&
      message.created_at > inbound.created_at &&
      message.send_source !== 'agent',
  )
}

export async function evaluateInboundMessage(data: AgentEvaluateJobData): Promise<void> {
  if (!isOpenAiConfigured()) {
    await recordSkip(data, 'ai_disabled')
    return
  }

  const settings = await agentRepository.getAgentSettings(data.organizationId)
  if (!settings.enabled) {
    await recordSkip(data, 'agent_disabled')
    return
  }

  const subscription = await getSubscriptionForOrganization(data.organizationId)
  if (!subscription.hasAccess) {
    await recordSkip(data, 'subscription_inactive')
    return
  }

  if (!isWithinBusinessHours(settings)) {
    await recordSkip(data, 'outside_business_hours')
    return
  }

  const messages = await listMessagesByConversationId(data.organizationId, data.conversationId)
  const targetMessage = messages.find((message) => message.id === data.messageId)
  if (targetMessage === undefined) {
    await recordSkip(data, 'message_not_found')
    return
  }

  const latestInbound = [...messages].reverse().find((message) => message.direction === 'inbound')
  if (latestInbound?.id !== data.messageId) {
    await recordSkip(data, 'superseded_by_newer_message')
    return
  }

  if (hasHumanReplyAfterInbound(messages, data.messageId)) {
    await recordSkip(data, 'human_replied')
    return
  }

  if (targetMessage.content_type !== 'text') {
    await recordSkip(data, 'non_text_message')
    return
  }

  const inboundMessage = targetMessage.content.trim()
  if (inboundMessage.length === 0) {
    await recordSkip(data, 'empty_message')
    return
  }

  const recentMessages = messages.slice(-SUGGEST_REPLY_MESSAGE_LIMIT)
  const recentTranscript = buildSuggestReplyTranscript(recentMessages)

  const gate = await runAgentGate({
    inboundMessage,
    recentTranscript,
  })

  if (gate.action !== 'reply') {
    await recordSkip(data, gate.reason ?? 'gate_skip', {
      confidence: gate.confidence ?? null,
      gateResult: gate,
    })
    return
  }

  const retrieved = await retrieveAgentContext({
    organizationId: data.organizationId,
    inboundMessage,
  })

  if (retrieved.coreContext.length === 0 && retrieved.chunks.length === 0) {
    await recordSkip(data, 'insufficient_context', {
      confidence: gate.confidence ?? null,
      gateResult: gate,
    })
    return
  }

  const reply = await generateAgentReply({
    inboundMessage,
    recentTranscript,
    retrievedContext: formatRetrievedContext(retrieved),
  })

  if (reply === null) {
    await recordSkip(data, 'invalid_reply_response', {
      gateResult: gate,
    })
    return
  }

  const policy = passesAgentPolicies({
    inboundMessage,
    reply: reply.reply,
  })

  const env = loadEnv()
  const threshold = Number(settings.confidence_threshold ?? env.AGENT_CONFIDENCE_THRESHOLD)
  const confidence = reply.confidence

  if (!policy.allowed || !reply.should_send || confidence < threshold) {
    await recordSkip(data, policy.reason ?? 'low_confidence', {
      confidence,
      gateResult: {
        gate,
        reply,
        policy,
      },
    })
    return
  }

  try {
    const sentMessage = await sendAgentTextReply({
      organizationId: data.organizationId,
      conversationId: data.conversationId,
      content: reply.reply,
    })

    await agentRepository.insertAgentDecision({
      organizationId: data.organizationId,
      conversationId: data.conversationId,
      messageId: data.messageId,
      action: 'send',
      reason: 'answerable',
      confidence,
      draftReply: reply.reply,
      sourcesUsed: reply.sources_used,
      sentMessageId: sentMessage.id,
      gateResult: {
        gate,
        reply,
        phase: 'auto_send',
      },
    })

    logger.warn(
      `[agent] Auto-reply sent org=${data.organizationId} conversation=${data.conversationId} message=${data.messageId} sentMessage=${sentMessage.id} confidence=${confidence}`,
    )
  } catch (error: unknown) {
    await agentRepository.insertAgentDecision({
      organizationId: data.organizationId,
      conversationId: data.conversationId,
      messageId: data.messageId,
      action: 'draft',
      reason: 'send_failed',
      confidence,
      draftReply: reply.reply,
      sourcesUsed: reply.sources_used,
      gateResult: {
        gate,
        reply,
        error: error instanceof Error ? error.message : String(error),
      },
    })

    logger.warn('[agent] Auto-reply send failed', {
      organizationId: data.organizationId,
      conversationId: data.conversationId,
      messageId: data.messageId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
