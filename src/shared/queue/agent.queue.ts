import { Queue } from 'bullmq'

import { loadEnv } from '../config/index.js'
import { getRedisConnectionOptions } from '../redis/client.js'
import { agentDefaultJobOptions } from './queue.options.js'
import { isDuplicateQueueJobError } from './worker.utils.js'

export const AGENT_QUEUE_NAME = 'agent-evaluate'

export const AGENT_JOB_NAMES = {
  evaluate: 'evaluate',
} as const

export type AgentEvaluateJobData = {
  organizationId: string
  conversationId: string
  messageId: string
}

let agentQueue: Queue | null = null

export function getAgentQueue(): Queue {
  if (agentQueue !== null) {
    return agentQueue
  }

  agentQueue = new Queue(AGENT_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: agentDefaultJobOptions(),
  })

  return agentQueue
}

export async function enqueueAgentEvaluateJob(data: AgentEvaluateJobData): Promise<void> {
  const env = loadEnv()
  const queue = getAgentQueue()
  const jobId = `agent-conv-${data.conversationId}`

  const existing = await queue.getJob(jobId)
  if (existing !== undefined) {
    const state = await existing.getState()
    if (state === 'delayed' || state === 'waiting') {
      await existing.remove()
    }
  }

  try {
    await queue.add(AGENT_JOB_NAMES.evaluate, data, {
      jobId,
      delay: env.AGENT_DEBOUNCE_MS,
    })
  } catch (error) {
    if (isDuplicateQueueJobError(error)) {
      return
    }

    throw error
  }
}

export async function closeAgentQueue(): Promise<void> {
  if (agentQueue === null) {
    return
  }

  await agentQueue.close()
  agentQueue = null
}
