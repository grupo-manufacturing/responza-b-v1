import { fetchInstagramMediaBinary } from '../../platforms/instagram/fetchMedia.js'
import { fetchWhatsAppMediaBinary } from '../../platforms/whatsapp/fetchMedia.js'
import { logger } from '../../shared/logger.js'
import { createMessageMediaSignedUrl, uploadMessageMedia } from '../../shared/storage/index.js'
import {
  buildMessageMediaStoragePath,
  extensionForImageMimeType,
  isAllowedInboundImageMimeType,
  MEDIA_MAX_FILE_SIZE_BYTES,
} from './media.constants.js'

export type StoredInboundImageResult = {
  storagePath: string
  mimeType: string
  fileSizeBytes: number
}

async function persistInboundImageBuffer(input: {
  organizationId: string
  conversationId: string
  platformMessageId: string
  buffer: Buffer
  mimeType: string
  mimeTypeHint: string | null
  logContext: Record<string, string>
}): Promise<StoredInboundImageResult | null> {
  const resolvedMimeType =
    input.mimeType.length > 0 && input.mimeType !== 'application/octet-stream'
      ? input.mimeType
      : (input.mimeTypeHint ?? 'application/octet-stream')

  if (!isAllowedInboundImageMimeType(resolvedMimeType)) {
    logger.warn('Skipping unsupported inbound image mime type', {
      ...input.logContext,
      mimeType: resolvedMimeType,
    })
    return null
  }

  if (input.buffer.byteLength > MEDIA_MAX_FILE_SIZE_BYTES) {
    logger.warn('Skipping inbound image over size limit', {
      ...input.logContext,
      fileSizeBytes: input.buffer.byteLength,
      maxBytes: MEDIA_MAX_FILE_SIZE_BYTES,
    })
    return null
  }

  const storagePath = buildMessageMediaStoragePath({
    organizationId: input.organizationId,
    conversationId: input.conversationId,
    platformMessageId: input.platformMessageId,
    extension: extensionForImageMimeType(resolvedMimeType),
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

export async function storeInboundWhatsAppImage(input: {
  organizationId: string
  conversationId: string
  platformMessageId: string
  platformMediaId: string
  mimeTypeHint: string | null
  accessToken: string
}): Promise<StoredInboundImageResult | null> {
  try {
    const downloaded = await fetchWhatsAppMediaBinary({
      mediaId: input.platformMediaId,
      accessToken: input.accessToken,
    })

    if (downloaded.fileSizeBytes > MEDIA_MAX_FILE_SIZE_BYTES) {
      logger.warn('Skipping WhatsApp image over size limit', {
        platformMessageId: input.platformMessageId,
        fileSizeBytes: downloaded.fileSizeBytes,
        maxBytes: MEDIA_MAX_FILE_SIZE_BYTES,
      })
      return null
    }

    return await persistInboundImageBuffer({
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
    logger.warn('Failed to store inbound WhatsApp image', {
      platformMessageId: input.platformMessageId,
      platformMediaId: input.platformMediaId,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

export async function storeInboundInstagramImage(input: {
  organizationId: string
  conversationId: string
  platformMessageId: string
  mediaUrl: string
  mimeTypeHint: string | null
  accessToken: string
}): Promise<StoredInboundImageResult | null> {
  try {
    const downloaded = await fetchInstagramMediaBinary({
      mediaUrl: input.mediaUrl,
      accessToken: input.accessToken,
    })

    if (downloaded.fileSizeBytes > MEDIA_MAX_FILE_SIZE_BYTES) {
      logger.warn('Skipping Instagram image over size limit', {
        platformMessageId: input.platformMessageId,
        fileSizeBytes: downloaded.fileSizeBytes,
        maxBytes: MEDIA_MAX_FILE_SIZE_BYTES,
      })
      return null
    }

    return await persistInboundImageBuffer({
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
    logger.warn('Failed to store inbound Instagram image', {
      platformMessageId: input.platformMessageId,
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
