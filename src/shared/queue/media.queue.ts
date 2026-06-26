import { Queue } from 'bullmq'

import type { IntegrationPlatform } from '../../modules/integrations/integrations.constants.js'
import type { InboundMediaContentType } from '../../modules/media/media.constants.js'
import { getRedisConnectionOptions } from '../redis/client.js'

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
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
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
    if (error instanceof Error && error.message.includes('Job already exists')) {
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
