import { Queue } from 'bullmq'

import type {
  ConversationAnalyticsBody,
  SuggestReplyBody,
  TranslateBody,
} from '../../modules/ai/ai.schemas.js'
import { getRedisConnectionOptions } from '../redis/client.js'
import { aiDefaultJobOptions } from './queue.options.js'
import { isDuplicateQueueJobError } from './worker.utils.js'

export const AI_QUEUE_NAME = 'ai-jobs'

export const AI_JOB_NAMES = {
  run: 'run',
} as const

export type AgentDraftReplyPayload = {
  organizationId: string
  messageId: string
  question: string
}

export type AiJobType = 'translate' | 'suggest-reply' | 'conversation-analytics' | 'agent-draft-reply'

export type AiJobPayloadByType = {
  translate: TranslateBody
  'suggest-reply': SuggestReplyBody
  'conversation-analytics': ConversationAnalyticsBody
  'agent-draft-reply': AgentDraftReplyPayload
}

export type AiQueueJobData<T extends AiJobType = AiJobType> = {
  jobId: string
  organizationId: string
  type: T
  payload: AiJobPayloadByType[T]
}

let aiQueue: Queue | null = null

export function getAiQueue(): Queue {
  if (aiQueue !== null) {
    return aiQueue
  }

  aiQueue = new Queue(AI_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: aiDefaultJobOptions(),
  })

  return aiQueue
}

export async function enqueueAiJob<T extends AiJobType>(
  data: AiQueueJobData<T>,
): Promise<void> {
  const queue = getAiQueue()

  try {
    await queue.add(AI_JOB_NAMES.run, data, {
      jobId: `ai-${data.jobId}`,
    })
  } catch (error) {
    if (isDuplicateQueueJobError(error)) {
      return
    }

    throw error
  }
}

export async function closeAiQueue(): Promise<void> {
  if (aiQueue === null) {
    return
  }

  await aiQueue.close()
  aiQueue = null
}
