import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { Connector, SendTextMessageResult } from '../types.js'

type GraphMessagesResponse = {
  messages?: Array<{ id?: string }>
}

type GraphErrorBody = {
  error?: {
    message?: string
    code?: number
    type?: string
  }
}

function graphApiBaseUrl(): string {
  const { WHATSAPP_GRAPH_VERSION } = loadEnv()
  return `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`
}

async function parseGraphError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as GraphErrorBody
    const message = body.error?.message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  } catch {
    // ignore parse errors
  }

  return `WhatsApp API request failed (${response.status})`
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
    const message = await parseGraphError(response)
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const data = (await response.json()) as GraphMessagesResponse
  const platformMessageId = data.messages?.[0]?.id ?? null

  return {
    platformMessageId: typeof platformMessageId === 'string' ? platformMessageId : null,
  }
}

export const whatsAppConnector: Connector = {
  platform: 'whatsapp',
  sendTextMessage: sendWhatsAppTextMessage,
}
