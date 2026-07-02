import { loadEnv } from '../../shared/config/index.js'
import { logger } from '../../shared/logger.js'
import { enqueueAgentJob } from '../../shared/queue/agent.queue.js'
import * as businessRepository from '../business/business.repository.js'
import * as agentLimits from './agent.limits.js'
import * as agentRepository from './agent.repository.js'
import { runAgentJob } from './agent.service.js'
import type { AgentJobResult, AgentQueueJobData } from './agent.schemas.js'

export type MaybeEnqueueAgentJobInput = {
  organizationId: string
  conversationId: string
  inboundMessageId: string
  contentType: string
  content: string
}

function isEnqueueableTextMessage(contentType: string, content: string): boolean {
  if (contentType !== 'text') {
    return false
  }

  return content.trim().length > 0
}

export async function maybeEnqueueAgentJob(input: MaybeEnqueueAgentJobInput): Promise<void> {
  const env = loadEnv()

  if (!env.AGENT_ENABLED || !env.AI_ENABLED || env.OPENAI_API_KEY.trim().length === 0) {
    return
  }

  if (!isEnqueueableTextMessage(input.contentType, input.content)) {
    return
  }

  const orgAgentEnabled = await agentRepository.isAgentEnabledForOrganization(input.organizationId)
  if (!orgAgentEnabled) {
    return
  }

  const profile = await businessRepository.findProfileByOrganizationId(input.organizationId)
  if (profile === null || profile.completed_at === null) {
    return
  }

  if (!(await agentLimits.canAgentReplyToday(input.organizationId))) {
    return
  }

  const job: AgentQueueJobData = {
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    inboundMessageId: input.inboundMessageId,
  }

  await enqueueAgentJob(job)
}

export async function processAgentQueueJob(data: AgentQueueJobData): Promise<AgentJobResult> {
  const result = await runAgentJob(data)

  if (result.action === 'skipped') {
    logger.warn('[agent] Job skipped', {
      organizationId: data.organizationId,
      conversationId: data.conversationId,
      inboundMessageId: data.inboundMessageId,
      reason: result.reason,
    })
    return result
  }

  logger.info(
    `[agent] Auto-reply sent (org=${data.organizationId}, conversation=${data.conversationId}, message=${result.messageId})`,
  )

  return result
}
