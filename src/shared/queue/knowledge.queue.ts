import { randomUUID } from 'node:crypto'

import { Queue } from 'bullmq'

import { getRedisConnectionOptions } from '../redis/client.js'
import { knowledgeDefaultJobOptions } from './queue.options.js'
import { isDuplicateQueueJobError } from './worker.utils.js'

export const KNOWLEDGE_QUEUE_NAME = 'knowledge-jobs'

export const KNOWLEDGE_JOB_NAMES = {
  ingest: 'ingest',
  index: 'index',
} as const

export type KnowledgeQueueJobName = (typeof KNOWLEDGE_JOB_NAMES)[keyof typeof KNOWLEDGE_JOB_NAMES]

export type KnowledgeQueueJobData = {
  jobId: string
}

let knowledgeQueue: Queue | null = null

export function getKnowledgeQueue(): Queue {
  if (knowledgeQueue !== null) {
    return knowledgeQueue
  }

  knowledgeQueue = new Queue(KNOWLEDGE_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: knowledgeDefaultJobOptions(),
  })

  return knowledgeQueue
}

export async function enqueueKnowledgeJob(
  jobName: KnowledgeQueueJobName,
  data: KnowledgeQueueJobData,
  options?: { delayMs?: number },
): Promise<void> {
  const queue = getKnowledgeQueue()

  try {
    await queue.add(jobName, data, {
      jobId: `knowledge-${data.jobId}-${randomUUID()}`,
      delay: options?.delayMs,
    })
  } catch (error) {
    if (isDuplicateQueueJobError(error)) {
      return
    }

    throw error
  }
}

export async function closeKnowledgeQueue(): Promise<void> {
  if (knowledgeQueue === null) {
    return
  }

  await knowledgeQueue.close()
  knowledgeQueue = null
}
