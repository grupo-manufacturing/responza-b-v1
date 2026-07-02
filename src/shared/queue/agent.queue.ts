import { Queue } from 'bullmq'

import type { AgentQueueJobData } from '../../modules/agent/agent.schemas.js'
import { loadEnv } from '../config/index.js'
import { getRedisConnectionOptions } from '../redis/client.js'
import { agentDefaultJobOptions } from './queue.options.js'
import { isDuplicateQueueJobError } from './worker.utils.js'

export const AGENT_QUEUE_NAME = 'agent-jobs'

export const AGENT_JOB_NAMES = {
  run: 'run',
} as const

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

export async function enqueueAgentJob(data: AgentQueueJobData): Promise<void> {
  const env = loadEnv()
  const queue = getAgentQueue()

  try {
    await queue.add(AGENT_JOB_NAMES.run, data, {
      jobId: `agent-${data.conversationId}-${data.inboundMessageId}`,
      delay: env.AGENT_JOB_DEBOUNCE_MS,
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
