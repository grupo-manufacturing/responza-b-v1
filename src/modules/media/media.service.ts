import { randomUUID } from 'node:crypto'

import { fetchInstagramMediaBinary } from '../../platforms/instagram/fetchMedia.js'
import { fetchWhatsAppMediaBinary } from '../../platforms/whatsapp/fetchMedia.js'
import { AppError } from '../../shared/errors/index.js'
import { logger } from '../../shared/logger.js'
import { createMessageMediaSignedUrl, uploadMessageMedia } from '../../shared/storage/index.js'
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
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
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
