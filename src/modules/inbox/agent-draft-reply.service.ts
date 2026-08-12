import { loadEnv } from '../../shared/config/index.js'
import { logger } from '../../shared/logger.js'
import { enqueueAiJob, type AgentDraftReplyPayload } from '../../shared/queue/ai.queue.js'
import { askBusinessAgent } from '../knowledge/ask/ask.service.js'
import { countDocumentChunksByOrganizationId } from '../knowledge/repositories/document-chunk.repository.js'
import * as inboxRepository from './inbox.repository.js'
import type { MessageRecord } from './repositories/types.js'

export type { AgentDraftReplyPayload } from '../../shared/queue/ai.queue.js'

/** Recent thread window passed to the agent for draft quality (not tone). */
const AGENT_DRAFT_CONTEXT_MESSAGE_LIMIT = 10

export function isAgentDraftReplyPlatform(
  platform: string,
): platform is 'whatsapp' | 'instagram' {
  return platform === 'whatsapp' || platform === 'instagram'
}

export async function enqueueAgentDraftReplyJob(
  payload: AgentDraftReplyPayload,
): Promise<void> {
  const env = loadEnv()
  if (!env.AI_ENABLED) {
    return
  }

  await enqueueAiJob({
    jobId: payload.messageId,
    organizationId: payload.organizationId,
    type: 'agent-draft-reply',
    payload,
  })
}

function formatConversationTranscript(messages: MessageRecord[]): string {
  return messages
    .map((message) => {
      const speaker = message.direction === 'inbound' ? 'Customer' : 'You'
      const content = message.content.trim()
      return `${speaker}: ${content.length > 0 ? content : '[empty message]'}`
    })
    .join('\n')
}

export async function runAgentDraftReply(payload: AgentDraftReplyPayload): Promise<void> {
  const env = loadEnv()
  if (!env.AI_ENABLED) {
    return
  }

  const chunkCount = await countDocumentChunksByOrganizationId(payload.organizationId)
  if (chunkCount === 0) {
    return
  }

  const recentMessages = await inboxRepository.listRecentMessagesForConversation({
    organization_id: payload.organizationId,
    conversation_id: payload.conversationId,
    limit: AGENT_DRAFT_CONTEXT_MESSAGE_LIMIT,
  })

  const conversationContext =
    recentMessages.length > 0 ? formatConversationTranscript(recentMessages) : undefined

  const result = await askBusinessAgent(payload.organizationId, payload.question, {
    conversationContext,
  })
  if (result.is_fallback || result.answer.trim().length === 0) {
    return
  }

  const updated = await inboxRepository.updateMessageSuggestedReply({
    organization_id: payload.organizationId,
    message_id: payload.messageId,
    suggested_reply: result.answer.trim(),
  })

  if (updated === null) {
    return
  }

  logger.info(
    `Agent draft reply saved for message ${payload.messageId} in organization ${payload.organizationId}`,
  )
}
