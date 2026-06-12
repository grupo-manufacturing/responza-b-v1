import { parseGraphApiError } from '../shared/graphErrors.js'
import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { Connector, SendTextMessageResult } from '../types.js'

type GraphMessagesResponse = {
  messages?: Array<{ id?: string }>
}

function graphApiBaseUrl(): string {
  const { WHATSAPP_GRAPH_VERSION } = loadEnv()
  return `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`
}

export async function sendWhatsAppTextMessage(input: {
  to: string
  content: string
  phoneNumberId: string
  accessToken: string
}): Promise<SendTextMessageResult> {
  const to = input.to.trim()
  const content = input.content.trim()
  const phoneNumberId = input.phoneNumberId.trim()
  const accessToken = input.accessToken.trim()

  if (to.length === 0 || content.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Recipient and message content are required')
  }

  if (phoneNumberId.length === 0 || accessToken.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'WhatsApp is not configured for sending')
  }

  const url = `${graphApiBaseUrl()}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: content },
    }),
  })

  if (!response.ok) {
    const message = await parseGraphApiError(response, 'WhatsApp API request failed')
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const data = (await response.json()) as GraphMessagesResponse
  const platformMessageId = data.messages?.[0]?.id ?? null

  return {
    platformMessageId: typeof platformMessageId === 'string' ? platformMessageId : null,
  }
}

export async function sendWhatsAppReaction(input: {
  to: string
  messageId: string
  emoji: string | null
  phoneNumberId: string
  accessToken: string
}): Promise<void> {
  const to = input.to.trim()
  const messageId = input.messageId.trim()
  const phoneNumberId = input.phoneNumberId.trim()
  const accessToken = input.accessToken.trim()

  if (to.length === 0 || messageId.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Recipient and message id are required')
  }

  if (phoneNumberId.length === 0 || accessToken.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'WhatsApp is not configured for sending')
  }

  const url = `${graphApiBaseUrl()}/${phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'reaction',
      reaction: {
        message_id: messageId,
        emoji: input.emoji ?? '',
      },
    }),
  })

  if (!response.ok) {
    const message = await parseGraphApiError(response, 'WhatsApp API request failed')
    throw new AppError(502, 'BAD_REQUEST', message)
  }
}

export const whatsAppConnector: Connector = {
  platform: 'whatsapp',
  sendTextMessage: sendWhatsAppTextMessage,
}
