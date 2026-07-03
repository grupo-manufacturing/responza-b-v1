import { randomUUID } from 'node:crypto'

import { fetchInstagramMediaBinary } from '../../platforms/instagram/fetchMedia.js'
import { fetchWhatsAppMediaBinary } from '../../platforms/whatsapp/fetchMedia.js'
import {
  getInstagramCredentialsForOrganization,
  getWhatsAppCredentialsForOrganization,
} from '../integrations/credentials.service.js'
import { AppError } from '../../shared/errors/index.js'
import { logger } from '../../shared/logger.js'
import { getRedisClient } from '../../shared/redis/client.js'
import { enqueueInboundMediaIngestionJob } from '../../shared/queue/index.js'
import {
  createMessageMediaSignedUrl,
  getMessageMediaBucketName,
  messageMediaExists,
  uploadMessageMedia,
} from '../../shared/storage/index.js'
import {
  buildMessageMediaStoragePath,
  buildMediaDownloadFilename,
  buildOutboundMediaStoragePath,
  extensionForMediaMimeType,
  isStoragePathForConversation,
  MEDIA_MAX_FILE_SIZE_BYTES,
  resolveStorageMimeType,
  sniffMimeTypeFromBuffer,
  type InboundMediaContentType,
  type OutboundMediaContentType,
} from './media.constants.js'

export type StoredInboundMediaResult = {
  storagePath: string
  mimeType: string
  fileSizeBytes: number
}

async function persistInboundMediaBuffer(input: {
  contentType: InboundMediaContentType
  organizationId: string
  conversationId: string
  platformMessageId: string
  buffer: Buffer
  mimeType: string
  mimeTypeHint: string | null
  filename?: string | null
  mediaUrl?: string | null
  logContext: Record<string, string>
}): Promise<StoredInboundMediaResult | null> {
  const resolvedMimeType = resolveStorageMimeType({
    contentType: input.contentType,
    downloadedMime: input.mimeType,
    mimeTypeHint: input.mimeTypeHint,
    filename: input.filename,
    mediaUrl: input.mediaUrl,
    sniffedMime: sniffMimeTypeFromBuffer(input.buffer),
  })

  if (resolvedMimeType === null) {
    logger.warn('Skipping unsupported inbound media mime type', {
      ...input.logContext,
      contentType: input.contentType,
      mimeType: input.mimeType,
      mimeTypeHint: input.mimeTypeHint,
    })
    return null
  }

  if (input.buffer.byteLength > MEDIA_MAX_FILE_SIZE_BYTES) {
    logger.warn('Skipping inbound media over size limit', {
      ...input.logContext,
      contentType: input.contentType,
      fileSizeBytes: input.buffer.byteLength,
      maxBytes: MEDIA_MAX_FILE_SIZE_BYTES,
    })
    return null
  }

  const storagePath = buildMessageMediaStoragePath({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    platformMessageId: input.platformMessageId,
    extension: extensionForMediaMimeType(input.contentType, resolvedMimeType),
  })

  await uploadMessageMedia({
    storagePath,
    body: input.buffer,
    mimeType: resolvedMimeType,
  })

  return {
    storagePath,
    mimeType: resolvedMimeType,
    fileSizeBytes: input.buffer.byteLength,
  }
}

export async function storeInboundWhatsAppMedia(input: {
  contentType: InboundMediaContentType
  organizationId: string
  conversationId: string
  platformMessageId: string
  platformMediaId: string
  mimeTypeHint: string | null
  filename?: string | null
  accessToken: string
}): Promise<StoredInboundMediaResult | null> {
  try {
    const downloaded = await fetchWhatsAppMediaBinary({
      mediaId: input.platformMediaId,
      accessToken: input.accessToken,
    })

    if (downloaded.fileSizeBytes > MEDIA_MAX_FILE_SIZE_BYTES) {
      logger.warn('Skipping WhatsApp media over size limit', {
        platformMessageId: input.platformMessageId,
        contentType: input.contentType,
        fileSizeBytes: downloaded.fileSizeBytes,
        maxBytes: MEDIA_MAX_FILE_SIZE_BYTES,
      })
      return null
    }

    return await persistInboundMediaBuffer({
      contentType: input.contentType,
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      platformMessageId: input.platformMessageId,
      buffer: downloaded.buffer,
      mimeType: downloaded.mimeType,
      mimeTypeHint: input.mimeTypeHint,
      filename: input.filename,
      logContext: {
        platform: 'whatsapp',
        platformMessageId: input.platformMessageId,
      },
    })
  } catch (error) {
    logger.warn('Failed to store inbound WhatsApp media', {
      platformMessageId: input.platformMessageId,
      platformMediaId: input.platformMediaId,
      contentType: input.contentType,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function storeInboundInstagramMedia(input: {
  contentType: InboundMediaContentType
  organizationId: string
  conversationId: string
  platformMessageId: string
  mediaUrl: string
  mimeTypeHint: string | null
  filename?: string | null
  accessToken: string
}): Promise<StoredInboundMediaResult | null> {
  try {
    const downloaded = await fetchInstagramMediaBinary({
      mediaUrl: input.mediaUrl,
      accessToken: input.accessToken,
    })

    if (downloaded.fileSizeBytes > MEDIA_MAX_FILE_SIZE_BYTES) {
      logger.warn('Skipping Instagram media over size limit', {
        platformMessageId: input.platformMessageId,
        contentType: input.contentType,
        fileSizeBytes: downloaded.fileSizeBytes,
        maxBytes: MEDIA_MAX_FILE_SIZE_BYTES,
      })
      return null
    }

    return await persistInboundMediaBuffer({
      contentType: input.contentType,
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      platformMessageId: input.platformMessageId,
      buffer: downloaded.buffer,
      mimeType: downloaded.mimeType,
      mimeTypeHint: input.mimeTypeHint,
      filename: input.filename,
      mediaUrl: input.mediaUrl,
      logContext: {
        platform: 'instagram',
        platformMessageId: input.platformMessageId,
      },
    })
  } catch (error) {
    logger.warn('Failed to store inbound Instagram media', {
      platformMessageId: input.platformMessageId,
      contentType: input.contentType,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function resolveMessageMediaUrl(
  storagePath: string | null,
  options?: {
    contentType?: 'text' | 'image' | 'video' | 'audio' | 'document'
    mimeType?: string | null
    content?: string
  },
): Promise<string | null> {
  if (storagePath === null || storagePath.length === 0) {
    return null
  }

  const exists = await messageMediaExists(storagePath)
  if (!exists) {
    return null
  }

  try {
    const download =
      options?.contentType === 'document'
        ? buildMediaDownloadFilename({
            storagePath,
            content: options.content ?? '',
            mimeType: options.mimeType ?? null,
          })
        : undefined

    return await createMessageMediaSignedUrl(storagePath, { download })
  } catch (error) {
    logger.warn('Failed to create signed media URL', {
      storagePath,
      bucket: getMessageMediaBucketName(),
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

const MEDIA_REPAIR_DEDUP_TTL_SECONDS = 60 * 60

export async function scheduleInboundMediaRepair(message: {
  id: string
  organization_id: string
  conversation_id: string
  direction: string
  platform_message_id: string | null
  content_type: string
  storage_path: string | null
  platform_media_id: string | null
  mime_type: string | null
}): Promise<void> {
  if (message.direction !== 'inbound' || message.content_type === 'text') {
    return
  }

  if (message.storage_path === null || message.storage_path.length === 0) {
    return
  }

  if (
    message.platform_media_id === null ||
    message.platform_media_id.length === 0 ||
    message.platform_message_id === null ||
    message.platform_message_id.length === 0
  ) {
    return
  }

  const dedupKey = `media-repair:${message.id}`
  const acquired = await getRedisClient().set(
    dedupKey,
    '1',
    'EX',
    MEDIA_REPAIR_DEDUP_TTL_SECONDS,
    'NX',
  )
  if (acquired === null) {
    return
  }

  const platformMediaId = message.platform_media_id
  const isInstagram =
    platformMediaId.startsWith('http://') || platformMediaId.startsWith('https://')

  const credentials = isInstagram
    ? await getInstagramCredentialsForOrganization(message.organization_id)
    : await getWhatsAppCredentialsForOrganization(message.organization_id)

  if (credentials === null) {
    logger.warn('Cannot repair missing message media: integration credentials unavailable', {
      messageId: message.id,
      organizationId: message.organization_id,
    })
    return
  }

  await enqueueInboundMediaIngestionJob({
    organizationId: message.organization_id,
    conversationId: message.conversation_id,
    messageId: message.id,
    platform: isInstagram ? 'instagram' : 'whatsapp',
    contentType: message.content_type as InboundMediaContentType,
    platformMessageId: message.platform_message_id,
    accessToken: credentials.accessToken,
    platformMediaId: isInstagram ? undefined : platformMediaId,
    mediaUrl: isInstagram ? platformMediaId : undefined,
    mimeTypeHint: message.mime_type,
    filename: null,
  })

  logger.info(`Scheduled inbound media repair for message ${message.id}`)
}

export type StoredOutboundMediaResult = {
  storagePath: string
  mimeType: string
  fileSizeBytes: number
}

export function assertOutboundMediaStoragePath(input: {
  organizationId: string
  conversationId: string
  storagePath: string
}): void {
  if (!isStoragePathForConversation(input)) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid media storage path')
  }
}

export async function storeOutboundConversationMedia(input: {
  organizationId: string
  conversationId: string
  contentType: OutboundMediaContentType
  buffer: Buffer
  mimeTypeHint: string
  filename?: string | null
}): Promise<StoredOutboundMediaResult> {
  if (input.buffer.byteLength === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media file is required')
  }

  if (input.buffer.byteLength > MEDIA_MAX_FILE_SIZE_BYTES) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media file exceeds the 2 MB limit')
  }

  const resolvedMimeType = resolveStorageMimeType({
    contentType: input.contentType,
    downloadedMime: input.mimeTypeHint,
    mimeTypeHint: input.mimeTypeHint,
    filename: input.filename,
    sniffedMime: sniffMimeTypeFromBuffer(input.buffer),
  })

  if (resolvedMimeType === null) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Unsupported media file type')
  }

  const storagePath = buildOutboundMediaStoragePath({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    uploadId: randomUUID(),
    extension: extensionForMediaMimeType(input.contentType, resolvedMimeType),
  })

  await uploadMessageMedia({
    storagePath,
    body: input.buffer,
    mimeType: resolvedMimeType,
  })

  return {
    storagePath,
    mimeType: resolvedMimeType,
    fileSizeBytes: input.buffer.byteLength,
  }
}
