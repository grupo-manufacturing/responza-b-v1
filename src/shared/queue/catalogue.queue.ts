import { Queue } from 'bullmq'

import { getRedisConnectionOptions } from '../redis/client.js'
import { catalogueDefaultJobOptions } from './queue.options.js'
import { isDuplicateQueueJobError } from './worker.utils.js'

export const CATALOGUE_QUEUE_NAME = 'catalogue-index'

export const CATALOGUE_JOB_NAMES = {
  index: 'index',
  delete: 'delete',
} as const

export type CatalogueIndexJobData = {
  organizationId: string
  fileId: string
  storagePath: string
  filename: string
  mimeType: string
}

export type CatalogueDeleteJobData = {
  organizationId: string
  fileId: string
}

let catalogueQueue: Queue | null = null

export function getCatalogueQueue(): Queue {
  if (catalogueQueue !== null) {
    return catalogueQueue
  }

  catalogueQueue = new Queue(CATALOGUE_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: catalogueDefaultJobOptions(),
  })

  return catalogueQueue
}

export async function enqueueCatalogueIndexJob(data: CatalogueIndexJobData): Promise<void> {
  const queue = getCatalogueQueue()

  try {
    await queue.add(CATALOGUE_JOB_NAMES.index, data, {
      jobId: `catalogue-index-${data.organizationId}-${data.fileId}`,
    })
  } catch (error) {
    if (isDuplicateQueueJobError(error)) {
      return
    }

    throw error
  }
}

export async function enqueueCatalogueDeleteJob(data: CatalogueDeleteJobData): Promise<void> {
  const queue = getCatalogueQueue()

  try {
    await queue.add(CATALOGUE_JOB_NAMES.delete, data, {
      jobId: `catalogue-delete-${data.organizationId}-${data.fileId}`,
    })
  } catch (error) {
    if (isDuplicateQueueJobError(error)) {
      return
    }

    throw error
  }
}

export async function closeCatalogueQueue(): Promise<void> {
  if (catalogueQueue === null) {
    return
  }

  await catalogueQueue.close()
  catalogueQueue = null
}
