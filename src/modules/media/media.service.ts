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

    const mimeType =
      downloaded.mimeType.length > 0
        ? downloaded.mimeType
        : (input.mimeTypeHint ?? 'application/octet-stream')

    if (!isAllowedInboundImageMimeType(mimeType)) {
      logger.warn('Skipping unsupported WhatsApp image mime type', {
        platformMessageId: input.platformMessageId,
        mimeType,
      })
      return null
    }

    const fileSizeBytes = downloaded.fileSizeBytes
    if (fileSizeBytes > MEDIA_MAX_FILE_SIZE_BYTES) {
      logger.warn('Skipping WhatsApp image over size limit', {
        platformMessageId: input.platformMessageId,
        fileSizeBytes,
        maxBytes: MEDIA_MAX_FILE_SIZE_BYTES,
      })
      return null
    }

    if (downloaded.buffer.byteLength > MEDIA_MAX_FILE_SIZE_BYTES) {
      logger.warn('Skipping WhatsApp image download over size limit', {
        platformMessageId: input.platformMessageId,
        fileSizeBytes: downloaded.buffer.byteLength,
        maxBytes: MEDIA_MAX_FILE_SIZE_BYTES,
      })
      return null
    }

    const storagePath = buildMessageMediaStoragePath({
      organizationId: input.organizationId,
      conversationId: input.conversationId,
      platformMessageId: input.platformMessageId,
      extension: extensionForImageMimeType(mimeType),
    })

    await uploadMessageMedia({
      storagePath,
      body: downloaded.buffer,
      mimeType,
    })

    return {
      storagePath,
      mimeType,
      fileSizeBytes: downloaded.buffer.byteLength,
    }
  } catch (error) {
    logger.warn('Failed to store inbound WhatsApp image', {
      platformMessageId: input.platformMessageId,
      platformMediaId: input.platformMediaId,
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
