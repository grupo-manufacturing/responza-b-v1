import { AppError } from '../shared/errors/index.js'
import {
  getWhatsAppCredentialsForOrganization,
  getInstagramCredentialsForOrganization,
} from '../modules/integrations/credentials.service.js'
import type {
  WhatsAppIntegrationMetadata,
  InstagramIntegrationMetadata,
  IntegrationCredentials,
} from '../modules/integrations/integrations.constants.js'
import type { OutboundMessageInput, SendMessageResult } from './types.js'
import { sendInstagramMediaMessage, sendInstagramTextMessage } from './instagram/instagram.connector.js'
import { sendWhatsAppMediaMessage, sendWhatsAppTextMessage } from './whatsapp/whatsapp.connector.js'
import { uploadWhatsAppMedia } from './whatsapp/uploadMedia.js'
import { createMessageMediaSignedUrl, downloadMessageMedia } from '../shared/storage/index.js'
import { isMediaContentType } from '../modules/inbox/inbox.schemas.js'

async function resolveCredentials(
  platform: 'whatsapp' | 'instagram',
  organizationId: string,
  integrationId: string,
): Promise<IntegrationCredentials> {
  const credentials =
    platform === 'whatsapp'
      ? await getWhatsAppCredentialsForOrganization(organizationId)
      : await getInstagramCredentialsForOrganization(organizationId)

  const platformLabel = platform === 'whatsapp' ? 'WhatsApp' : 'Instagram'

  if (credentials === null) {
    throw new AppError(400, 'BAD_REQUEST', `Connect ${platformLabel} before sending messages`)
  }

  if (credentials.integrationId !== integrationId) {
    throw new AppError(400, 'BAD_REQUEST', `Conversation channel is not linked to ${platformLabel}`)
  }

  return credentials
}

export async function dispatchOutboundMessage(
  input: OutboundMessageInput,
): Promise<SendMessageResult> {
  if (isMediaContentType(input.contentType)) {
    if (input.media === undefined) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Media attachment is required')
    }

    switch (input.platform) {
      case 'whatsapp':
        return dispatchWhatsAppMediaMessage(input)
      case 'instagram':
        return dispatchInstagramMediaMessage(input)
      default:
        throw new AppError(400, 'BAD_REQUEST', `Unsupported platform: ${input.platform}`)
    }
  }

  switch (input.platform) {
    case 'whatsapp':
      return dispatchWhatsAppTextMessage(input)
    case 'instagram':
      return dispatchInstagramTextMessage(input)
    default:
      throw new AppError(400, 'BAD_REQUEST', `Unsupported platform: ${input.platform}`)
  }
}

async function dispatchWhatsAppTextMessage(
  input: OutboundMessageInput,
): Promise<SendMessageResult> {
  const credentials = await resolveCredentials('whatsapp', input.organizationId, input.integrationId)

  return sendWhatsAppTextMessage({
    to: input.recipientExternalId,
    content: input.content,
    phoneNumberId: (credentials.metadata as WhatsAppIntegrationMetadata).phone_number_id,
    accessToken: credentials.accessToken,
  })
}

async function dispatchInstagramTextMessage(
  input: OutboundMessageInput,
): Promise<SendMessageResult> {
  const credentials = await resolveCredentials('instagram', input.organizationId, input.integrationId)

  return sendInstagramTextMessage({
    to: input.recipientExternalId,
    content: input.content,
    businessAccountId: (credentials.metadata as InstagramIntegrationMetadata).business_account_id,
    accessToken: credentials.accessToken,
  })
}

async function dispatchWhatsAppMediaMessage(
  input: OutboundMessageInput,
): Promise<SendMessageResult> {
  if (!isMediaContentType(input.contentType) || input.media === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media attachment is required')
  }

  const credentials = await resolveCredentials('whatsapp', input.organizationId, input.integrationId)
  const phoneNumberId = (credentials.metadata as WhatsAppIntegrationMetadata).phone_number_id
  const buffer = await downloadMessageMedia(input.media.storagePath)
  const platformMediaId = await uploadWhatsAppMedia({
    phoneNumberId,
    accessToken: credentials.accessToken,
    buffer,
    mimeType: input.media.mimeType,
    filename: input.media.filename,
  })

  const delivery = await sendWhatsAppMediaMessage({
    to: input.recipientExternalId,
    contentType: input.contentType,
    mediaId: platformMediaId,
    caption: input.content,
    filename: input.media.filename,
    phoneNumberId,
    accessToken: credentials.accessToken,
  })

  return {
    ...delivery,
    platformMediaId,
  }
}

async function dispatchInstagramMediaMessage(
  input: OutboundMessageInput,
): Promise<SendMessageResult> {
  if (!isMediaContentType(input.contentType) || input.media === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media attachment is required')
  }

  const credentials = await resolveCredentials('instagram', input.organizationId, input.integrationId)
  const businessAccountId = (credentials.metadata as InstagramIntegrationMetadata).business_account_id
  const mediaUrl = await createMessageMediaSignedUrl(input.media.storagePath)

  const delivery = await sendInstagramMediaMessage({
    to: input.recipientExternalId,
    contentType: input.contentType,
    mediaUrl,
    businessAccountId,
    accessToken: credentials.accessToken,
  })

  if (input.content.trim().length > 0) {
    await sendInstagramTextMessage({
      to: input.recipientExternalId,
      content: input.content,
      businessAccountId,
      accessToken: credentials.accessToken,
    })
  }

  return delivery
}
