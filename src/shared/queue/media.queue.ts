import { Queue } from 'bullmq'

import type { IntegrationPlatform } from '../../modules/integrations/integrations.constants.js'
import type { InboundMediaContentType } from '../../modules/media/media.constants.js'
import { getRedisConnectionOptions } from '../redis/client.js'
import { mediaDefaultJobOptions } from './queue.options.js'
import { isDuplicateQueueJobError } from './worker.utils.js'

export const MEDIA_QUEUE_NAME = 'media-ingestion'

export const MEDIA_JOB_NAMES = {
  ingest: 'ingest',
} as const

export type InboundMediaIngestionJobData = {
  organizationId: string
  conversationId: string
  messageId: string
  platform: Extract<IntegrationPlatform, 'whatsapp' | 'instagram'>
  contentType: InboundMediaContentType
  platformMessageId: string
  accessToken: string
  platformMediaId?: string
  mediaUrl?: string
  mimeTypeHint: string | null
  filename?: string | null
}

let mediaQueue: Queue | null = null

export function getMediaQueue(): Queue {
  if (mediaQueue !== null) {
    return mediaQueue
  }

  mediaQueue = new Queue(MEDIA_QUEUE_NAME, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: mediaDefaultJobOptions(),
  })

  return mediaQueue
}

export async function enqueueInboundMediaIngestionJob(
  data: InboundMediaIngestionJobData,
): Promise<void> {
  const queue = getMediaQueue()

  try {
    await queue.add(MEDIA_JOB_NAMES.ingest, data, {
      jobId: `ingest-media-${data.messageId}`,
    })
  } catch (error) {
    if (isDuplicateQueueJobError(error)) {
      return
    }

    throw error
  }
}

export async function closeMediaQueue(): Promise<void> {
  if (mediaQueue === null) {
    return
  }

  await mediaQueue.close()
  mediaQueue = null
}
