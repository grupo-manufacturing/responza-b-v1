import * as inboxRepository from '../inbox/inbox.repository.js'
import { storeInboundInstagramMedia, storeInboundWhatsAppMedia } from './media.service.js'
import type { InboundMediaIngestionJobData } from '../../shared/queue/media.queue.js'
import { logger } from '../../shared/logger.js'
import { messageMediaExists } from '../../shared/storage/index.js'

export async function processInboundMediaIngestionJob(
  data: InboundMediaIngestionJobData,
): Promise<void> {
  const existing = await inboxRepository.findMessageById({
    organization_id: data.organizationId,
    conversation_id: data.conversationId,
    message_id: data.messageId,
  })

  if (existing === null) {
    logger.warn('Inbound media ingestion skipped: message not found', {
      messageId: data.messageId,
      conversationId: data.conversationId,
    })
    return
  }

  if (existing.storage_path !== null) {
    const storedObjectExists = await messageMediaExists(existing.storage_path)
    if (storedObjectExists) {
      return
    }

    logger.warn('Inbound media ingestion repairing missing storage object', {
      messageId: data.messageId,
      storagePath: existing.storage_path,
      platform: data.platform,
    })

    await inboxRepository.clearInboundMessageStoragePath({
      organization_id: data.organizationId,
      message_id: data.messageId,
    })
  }

  let stored: Awaited<ReturnType<typeof storeInboundWhatsAppMedia>> | Awaited<
    ReturnType<typeof storeInboundInstagramMedia>
  > | null = null

  if (data.platform === 'whatsapp') {
    if (data.platformMediaId !== undefined) {
      stored = await storeInboundWhatsAppMedia({
        contentType: data.contentType,
        organizationId: data.organizationId,
        conversationId: data.conversationId,
        platformMessageId: data.platformMessageId,
        platformMediaId: data.platformMediaId,
        mimeTypeHint: data.mimeTypeHint,
        filename: data.filename ?? null,
        accessToken: data.accessToken,
      })
    }
  } else if (data.platform === 'instagram') {
    if (data.mediaUrl !== undefined) {
      stored = await storeInboundInstagramMedia({
        contentType: data.contentType,
        organizationId: data.organizationId,
        conversationId: data.conversationId,
        platformMessageId: data.platformMessageId,
        mediaUrl: data.mediaUrl,
        mimeTypeHint: data.mimeTypeHint,
        filename: data.filename ?? null,
        accessToken: data.accessToken,
      })
    }
  }

  if (stored === null) {
    logger.warn('Inbound media ingestion produced no stored file', {
      messageId: data.messageId,
      platform: data.platform,
      platformMessageId: data.platformMessageId,
    })
    return
  }

  await inboxRepository.updateInboundMessageMedia({
    organization_id: data.organizationId,
    message_id: data.messageId,
    storage_path: stored.storagePath,
    mime_type: stored.mimeType,
    file_size_bytes: stored.fileSizeBytes,
    platform_media_id: data.platformMediaId ?? data.mediaUrl ?? null,
  })
}
