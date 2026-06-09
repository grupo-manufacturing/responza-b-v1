import { AppError, isAppError } from '../shared/errors/index.js'
import {
  getInstagramCredentialsForOrganization,
  getWhatsAppCredentialsForOrganization,
  updateInstagramMessagingAccountId,
} from '../modules/integrations/integrations.service.js'
import {
  instagramConnector,
  isRetryableInstagramAccountError,
} from './instagram/index.js'
import type { OutboundTextMessageInput, SendTextMessageResult } from './types.js'
import { whatsAppConnector } from './whatsapp/index.js'

export async function dispatchOutboundMessage(
  input: OutboundTextMessageInput,
): Promise<SendTextMessageResult> {
  switch (input.platform) {
    case 'whatsapp':
      return dispatchWhatsAppMessage(input)
    case 'instagram':
      return dispatchInstagramMessage(input)
    case 'indiamart':
      return { platformMessageId: null }
    default:
      throw new AppError(400, 'BAD_REQUEST', `Unsupported platform: ${input.platform}`)
  }
}

async function dispatchWhatsAppMessage(
  input: OutboundTextMessageInput,
): Promise<SendTextMessageResult> {
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
    phoneNumberId: credentials.metadata.phone_number_id,
    accessToken: credentials.accessToken,
  })
}

async function dispatchInstagramMessage(
  input: OutboundTextMessageInput,
): Promise<SendTextMessageResult> {
  const credentials = await getInstagramCredentialsForOrganization(input.organizationId)

  if (credentials === null) {
    throw new AppError(400, 'BAD_REQUEST', 'Connect Instagram before sending messages')
  }

  if (credentials.integrationId !== input.integrationId) {
    throw new AppError(400, 'BAD_REQUEST', 'Conversation channel is not linked to Instagram')
  }

  const primaryId = credentials.metadata.messaging_account_id?.trim() ?? ''
  const fallbackId = credentials.metadata.ig_user_id.trim()
  const candidateIds: string[] = []

  if (primaryId.length > 0) {
    candidateIds.push(primaryId)
  }
  if (fallbackId.length > 0 && fallbackId !== primaryId) {
    candidateIds.push(fallbackId)
  }

  if (candidateIds.length === 0) {
    throw new AppError(
      400,
      'BAD_REQUEST',
      'No Instagram account id for send path. Receive at least one webhook DM after connecting, then retry.',
    )
  }

  let lastError: unknown = null

  for (const igAccountId of candidateIds) {
    try {
      const result = await instagramConnector.sendTextMessage({
        igAccountId,
        to: input.recipientExternalId,
        content: input.content,
        accessToken: credentials.accessToken,
      })

      if (igAccountId !== primaryId) {
        await updateInstagramMessagingAccountId(input.organizationId, igAccountId)
      }

      return result
    } catch (error) {
      lastError = error
      if (!isRetryableInstagramAccountError(error)) {
        throw error
      }
    }
  }

  if (isAppError(lastError)) {
    throw lastError
  }

  throw new AppError(502, 'BAD_REQUEST', 'Instagram send failed')
}
