import { loadEnv } from '../../shared/config/index.js'
import { logger } from '../../shared/logger.js'
import { buildSuggestReplyTranscript } from '../ai/ai.utils.js'
import { completeChatJson } from '../ai/providers/openai.client.js'
import * as businessRepository from '../business/business.repository.js'
import { buildAgentBusinessContextLines } from '../business/business.url-context.service.js'
import * as inboxRepository from '../inbox/inbox.repository.js'
import { sendAgentReply } from './agent.outbound.service.js'
import { AGENT_CONTEXT_MESSAGE_LIMIT } from './agent.constants.js'
import * as agentLimits from './agent.limits.js'
import * as agentRepository from './agent.repository.js'
import {
  normalizeAgentReplyResponse,
  type AgentJobResult,
  type AgentJobSkipReason,
  type AgentQueueJobData,
} from './agent.schemas.js'
import { buildAgentSystemPrompt, buildAgentUserPrompt } from './prompts/agent.prompt.js'
import type { AgentInboundMessageRecord } from './agent.repository.js'

function isTextInboundMessage(contentType: string, content: string): boolean {
  if (contentType !== 'text') {
    return false
  }

  return content.trim().length > 0
}

async function evaluateSendGuards(
  data: AgentQueueJobData,
  inboundMessage: AgentInboundMessageRecord,
): Promise<AgentJobSkipReason | null> {
  if (!(await agentLimits.canAgentReplyToday(data.organizationId))) {
    return 'daily_limit_reached'
  }

  const latestInboundMessageId = await agentRepository.findLatestInboundMessageId(
    data.organizationId,
    data.conversationId,
  )

  if (latestInboundMessageId !== inboundMessage.id) {
    return 'superseded_by_newer_inbound'
  }

  const humanReplied = await agentRepository.hasHumanOutboundAfter({
    organizationId: data.organizationId,
    conversationId: data.conversationId,
    afterCreatedAt: inboundMessage.created_at,
  })

  if (humanReplied) {
    return 'human_replied'
  }

  const agentAlreadyReplied = await agentRepository.hasAgentOutboundAfter({
    organizationId: data.organizationId,
    conversationId: data.conversationId,
    afterCreatedAt: inboundMessage.created_at,
  })

  if (agentAlreadyReplied) {
    return 'already_replied'
  }

  return null
}

async function buildRecentTranscript(
  organizationId: string,
  conversationId: string,
): Promise<string | null> {
  const messages = await inboxRepository.listRecentMessagesForConversation({
    organization_id: organizationId,
    conversation_id: conversationId,
    limit: AGENT_CONTEXT_MESSAGE_LIMIT,
  })

  if (messages.length === 0) {
    return null
  }

  return buildSuggestReplyTranscript(messages)
}

export async function runAgentJob(data: AgentQueueJobData): Promise<AgentJobResult> {
  const env = loadEnv()

  if (!env.AGENT_ENABLED) {
    return { action: 'skipped', reason: 'agent_disabled_globally' }
  }

  if (!env.AI_ENABLED || env.OPENAI_API_KEY.trim().length === 0) {
    return { action: 'skipped', reason: 'ai_disabled' }
  }

  const orgAgentEnabled = await agentRepository.isAgentEnabledForOrganization(data.organizationId)
  if (!orgAgentEnabled) {
    return { action: 'skipped', reason: 'agent_disabled_for_org' }
  }

  const profile = await businessRepository.findProfileByOrganizationId(data.organizationId)
  if (profile === null || profile.completed_at === null) {
    return { action: 'skipped', reason: 'onboarding_incomplete' }
  }

  if (!(await agentLimits.canAgentReplyToday(data.organizationId))) {
    return { action: 'skipped', reason: 'daily_limit_reached' }
  }

  const inboundMessage = await agentRepository.findInboundMessage({
    organizationId: data.organizationId,
    conversationId: data.conversationId,
    messageId: data.inboundMessageId,
  })

  if (inboundMessage === null) {
    return { action: 'skipped', reason: 'inbound_message_not_found' }
  }

  if (!isTextInboundMessage(inboundMessage.content_type, inboundMessage.content)) {
    return { action: 'skipped', reason: 'unsupported_message_type' }
  }

  const initialGuard = await evaluateSendGuards(data, inboundMessage)
  if (initialGuard !== null) {
    return { action: 'skipped', reason: initialGuard }
  }

  let decision
  try {
    const recentTranscript = await buildRecentTranscript(data.organizationId, data.conversationId)
    const businessContextLines = await buildAgentBusinessContextLines(data.organizationId, profile, {
      customerMessage: inboundMessage.content,
    })
    const raw = await completeChatJson({
      system: buildAgentSystemPrompt(businessContextLines),
      user: buildAgentUserPrompt({
        customerMessage: inboundMessage.content,
        recentTranscript,
      }),
    })
    decision = normalizeAgentReplyResponse(raw)
  } catch (error: unknown) {
    logger.warn('[agent] Failed to generate reply decision', {
      organizationId: data.organizationId,
      conversationId: data.conversationId,
      inboundMessageId: data.inboundMessageId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { action: 'skipped', reason: 'no_reply_generated' }
  }

  if (!decision.shouldReply) {
    return { action: 'skipped', reason: 'not_answerable' }
  }

  const preSendGuard = await evaluateSendGuards(data, inboundMessage)
  if (preSendGuard !== null) {
    return { action: 'skipped', reason: preSendGuard }
  }

  if (!(await agentLimits.canAgentReplyToday(data.organizationId))) {
    return { action: 'skipped', reason: 'daily_limit_reached' }
  }

  const reserved = await agentLimits.reserveAgentReplySlot(data.organizationId)
  if (!reserved) {
    return { action: 'skipped', reason: 'daily_limit_reached' }
  }

  try {
    const sent = await sendAgentReply({
      organizationId: data.organizationId,
      conversationId: data.conversationId,
      content: decision.reply,
    })

    return {
      action: 'replied',
      messageId: sent.messageId,
    }
  } catch (error: unknown) {
    await agentLimits.releaseAgentReplySlot(data.organizationId)
    logger.warn('[agent] Failed to send auto-reply', {
      organizationId: data.organizationId,
      conversationId: data.conversationId,
      inboundMessageId: data.inboundMessageId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}
