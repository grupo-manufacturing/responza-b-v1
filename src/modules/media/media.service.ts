import { fetchInstagramMediaBinary } from '../../platforms/instagram/fetchMedia.js'
import { fetchWhatsAppMediaBinary } from '../../platforms/whatsapp/fetchMedia.js'
import { logger } from '../../shared/logger.js'
import { createMessageMediaSignedUrl, uploadMessageMedia } from '../../shared/storage/index.js'
import {
  buildMessageMediaStoragePath,
  extensionForMediaMimeType,
  isAllowedInboundMediaMimeType,
  MEDIA_MAX_FILE_SIZE_BYTES,
  type InboundMediaContentType,
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
  logContext: Record<string, string>
}): Promise<StoredInboundMediaResult | null> {
  const resolvedMimeType =
    input.mimeType.length > 0 && input.mimeType !== 'application/octet-stream'
      ? input.mimeType
      : (input.mimeTypeHint ?? 'application/octet-stream')

  if (!isAllowedInboundMediaMimeType(input.contentType, resolvedMimeType)) {
    logger.warn('Skipping unsupported inbound media mime type', {
      ...input.logContext,
      contentType: input.contentType,
      mimeType: resolvedMimeType,
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
): Promise<string | null> {
  if (storagePath === null || storagePath.length === 0) {
    return null
  }

  try {
    return await createMessageMediaSignedUrl(storagePath)
  } catch (error) {
    logger.warn('Failed to create signed media URL', {
      storagePath,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}
