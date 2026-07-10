import { Queue } from 'bullmq'

import type { KnowledgeIndexScope } from '../../modules/knowledge/knowledge.constants.js'
import { getRedisConnectionOptions } from '../redis/client.js'
import { knowledgeDefaultJobOptions } from './queue.options.js'
import { isDuplicateQueueJobError } from './worker.utils.js'

export const KNOWLEDGE_QUEUE_NAME = 'knowledge-index'

export const KNOWLEDGE_JOB_NAMES = {
  index: 'index',
  removeCatalogue: 'remove-catalogue',
  refreshWebsite: 'refresh-website',
  refreshInstagram: 'refresh-instagram',
} as const

export type KnowledgeIndexJobData = {
  organizationId: string
  scope?: KnowledgeIndexScope
  catalogueFileId?: string
}

export type KnowledgeRemoveCatalogueJobData = {
  organizationId: string
  catalogueFileId: string
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

function buildIndexJobId(data: KnowledgeIndexJobData): string {
  if (data.catalogueFileId !== undefined) {
    return `knowledge-${data.organizationId}-catalogue-${data.catalogueFileId}`
  }

  if (data.scope !== undefined && data.scope !== 'full') {
    return `knowledge-${data.organizationId}-${data.scope}`
  }

  return `knowledge-${data.organizationId}-full`
}

export async function enqueueKnowledgeIndexJob(data: KnowledgeIndexJobData): Promise<void> {
  const queue = getKnowledgeQueue()

  try {
    await queue.add(KNOWLEDGE_JOB_NAMES.index, data, {
      jobId: buildIndexJobId(data),
    })
  } catch (error) {
    if (isDuplicateQueueJobError(error)) {
      return
    }

    throw error
  }
}

export async function enqueueKnowledgeRemoveCatalogueJob(
  data: KnowledgeRemoveCatalogueJobData,
): Promise<void> {
  const queue = getKnowledgeQueue()

  try {
    await queue.add(KNOWLEDGE_JOB_NAMES.removeCatalogue, data, {
      jobId: `knowledge-remove-${data.organizationId}-${data.catalogueFileId}`,
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
