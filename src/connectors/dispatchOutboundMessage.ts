import { AppError } from '../shared/errors/index.js'
import { getWhatsAppCredentialsForOrganization } from '../modules/integrations/integrations.service.js'
import type { OutboundTextMessageInput, SendTextMessageResult } from './types.js'
import { whatsAppConnector } from './whatsapp/index.js'

export async function dispatchOutboundMessage(
  input: OutboundTextMessageInput,
): Promise<SendTextMessageResult> {
  switch (input.platform) {
    case 'whatsapp':
      return dispatchWhatsAppMessage(input)
    case 'instagram':
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
