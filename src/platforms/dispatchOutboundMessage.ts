import { AppError } from '../shared/errors/index.js'
import {
  getWhatsAppCredentialsForOrganization,
  getInstagramCredentialsForOrganization,
} from '../modules/integrations/credentials.service.js'
import type {
  WhatsAppIntegrationMetadata,
  InstagramIntegrationMetadata,
} from '../modules/integrations/integrations.constants.js'
import type { OutboundMessageInput, SendMessageResult } from './types.js'
import { sendInstagramMediaMessage, sendInstagramTextMessage } from './instagram/index.js'
import { whatsAppConnector } from './whatsapp/index.js'
import { sendWhatsAppMediaMessage } from './whatsapp/whatsapp.connector.js'
import { uploadWhatsAppMedia } from './whatsapp/uploadMedia.js'
import { createMessageMediaSignedUrl, downloadMessageMedia } from '../shared/storage/index.js'
import { isMediaContentType } from '../modules/inbox/inbox.schemas.js'

function isOutboundMediaContentType(
  contentType: OutboundMessageInput['contentType'],
): contentType is Exclude<OutboundMessageInput['contentType'], 'text'> {
  return isMediaContentType(contentType)
}

export async function dispatchOutboundMessage(
  input: OutboundMessageInput,
): Promise<SendMessageResult> {
  if (isOutboundMediaContentType(input.contentType)) {
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
  const credentials = await getWhatsAppCredentialsForOrganization(input.organizationId)

  if (credentials === null) {
    throw new AppError(400, 'BAD_REQUEST', 'Connect WhatsApp before sending messages')
  }

  if (credentials.integrationId !== input.integrationId) {
    throw new AppError(400, 'BAD_REQUEST', 'Conversation channel is not linked to WhatsApp')
  }

  return whatsAppConnector.sendTextMessage({
    to: input.recipientExternalId,
    content: input.content,
    phoneNumberId: (credentials.metadata as WhatsAppIntegrationMetadata).phone_number_id,
    accessToken: credentials.accessToken,
  })
}

async function dispatchInstagramTextMessage(
  input: OutboundMessageInput,
): Promise<SendMessageResult> {
  const credentials = await getInstagramCredentialsForOrganization(input.organizationId)

  if (credentials === null) {
    throw new AppError(400, 'BAD_REQUEST', 'Connect Instagram before sending messages')
  }

  if (credentials.integrationId !== input.integrationId) {
    throw new AppError(400, 'BAD_REQUEST', 'Conversation channel is not linked to Instagram')
  }

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
  if (!isOutboundMediaContentType(input.contentType) || input.media === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media attachment is required')
  }

  const credentials = await getWhatsAppCredentialsForOrganization(input.organizationId)

  if (credentials === null) {
    throw new AppError(400, 'BAD_REQUEST', 'Connect WhatsApp before sending messages')
  }

  if (credentials.integrationId !== input.integrationId) {
    throw new AppError(400, 'BAD_REQUEST', 'Conversation channel is not linked to WhatsApp')
  }

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
  if (!isOutboundMediaContentType(input.contentType) || input.media === undefined) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media attachment is required')
  }

  const credentials = await getInstagramCredentialsForOrganization(input.organizationId)

  if (credentials === null) {
    throw new AppError(400, 'BAD_REQUEST', 'Connect Instagram before sending messages')
  }

  if (credentials.integrationId !== input.integrationId) {
    throw new AppError(400, 'BAD_REQUEST', 'Conversation channel is not linked to Instagram')
  }

  const mediaUrl = await createMessageMediaSignedUrl(input.media.storagePath)

  const delivery = await sendInstagramMediaMessage({
    to: input.recipientExternalId,
    contentType: input.contentType,
    mediaUrl,
    businessAccountId: (credentials.metadata as InstagramIntegrationMetadata).business_account_id,
    accessToken: credentials.accessToken,
  })

  if (input.content.trim().length > 0) {
    await sendInstagramTextMessage({
      to: input.recipientExternalId,
      content: input.content,
      businessAccountId: (credentials.metadata as InstagramIntegrationMetadata).business_account_id,
      accessToken: credentials.accessToken,
    })
  }

  return delivery
}
