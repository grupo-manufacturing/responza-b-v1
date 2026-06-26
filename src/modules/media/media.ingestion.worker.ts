import * as inboxRepository from '../inbox/inbox.repository.js'
import { storeInboundInstagramMedia, storeInboundWhatsAppMedia } from './media.service.js'
import type { InboundMediaIngestionJobData } from '../../shared/queue/media.queue.js'
import { logger } from '../../shared/logger.js'

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
    return
  }

  const stored =
    data.platform === 'whatsapp' && data.platformMediaId !== undefined
      ? await storeInboundWhatsAppMedia({
          contentType: data.contentType,
          organizationId: data.organizationId,
          conversationId: data.conversationId,
          platformMessageId: data.platformMessageId,
          platformMediaId: data.platformMediaId,
          mimeTypeHint: data.mimeTypeHint,
          filename: data.filename ?? null,
          accessToken: data.accessToken,
        })
      : data.platform === 'instagram' && data.mediaUrl !== undefined
        ? await storeInboundInstagramMedia({
            contentType: data.contentType,
            organizationId: data.organizationId,
            conversationId: data.conversationId,
            platformMessageId: data.platformMessageId,
            mediaUrl: data.mediaUrl,
            mimeTypeHint: data.mimeTypeHint,
            filename: data.filename ?? null,
            accessToken: data.accessToken,
          })
        : null

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
