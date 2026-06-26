import { Queue } from 'bullmq'

import type {
  ConversationAnalyticsBody,
  RewriteBody,
  SuggestReplyBody,
  TranslateBody,
} from '../../modules/ai/ai.schemas.js'
import { getRedisConnectionOptions } from '../redis/client.js'

export const AI_QUEUE_NAME = 'ai-jobs'

export const AI_JOB_NAMES = {
  run: 'run',
} as const

export type AiJobType = 'rewrite' | 'translate' | 'suggest-reply' | 'conversation-analytics'

export type AiJobPayloadByType = {
  rewrite: RewriteBody
  translate: TranslateBody
  'suggest-reply': SuggestReplyBody
  'conversation-analytics': ConversationAnalyticsBody
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
    defaultJobOptions: {
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  })

  return aiQueue
}

export async function enqueueAiJob<T extends AiJobType>(
  data: AiQueueJobData<T>,
): Promise<void> {
  const queue = getAiQueue()
  await queue.add(AI_JOB_NAMES.run, data, {
    jobId: `ai-${data.jobId}`,
  })
}

export async function closeAiQueue(): Promise<void> {
  if (aiQueue === null) {
    return
  }

  await aiQueue.close()
  aiQueue = null
}
