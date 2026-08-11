import { loadEnv } from '../../shared/config/index.js'
import { logger } from '../../shared/logger.js'
import { enqueueAiJob, type AgentDraftReplyPayload } from '../../shared/queue/ai.queue.js'
import { askBusinessAgent } from '../knowledge/ask/ask.service.js'
import { countDocumentChunksByOrganizationId } from '../knowledge/repositories/document-chunk.repository.js'
import * as inboxRepository from './inbox.repository.js'

export type { AgentDraftReplyPayload } from '../../shared/queue/ai.queue.js'

export function isAgentDraftPlatform(
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

export async function runAgentDraftReply(payload: AgentDraftReplyPayload): Promise<void> {
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
