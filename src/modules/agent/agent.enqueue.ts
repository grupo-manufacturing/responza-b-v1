import { logger } from '../../shared/logger.js'
import { enqueueAgentEvaluateJob } from '../../shared/queue/agent.queue.js'

export async function enqueueAgentEvaluation(input: {
  organizationId: string
  conversationId: string
  messageId: string
}): Promise<void> {
  try {
    await enqueueAgentEvaluateJob(input)
  } catch (error: unknown) {
    logger.warn('[agent] Failed to enqueue agent evaluation job', {
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      messageId: input.messageId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
