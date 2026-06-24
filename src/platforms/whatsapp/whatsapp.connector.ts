import { parseGraphApiError } from '../shared/graphErrors.js'
import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { Connector, OutboundMediaContentType, SendMessageResult } from '../types.js'

type GraphMessagesResponse = {
  messages?: Array<{ id?: string }>
}

function graphApiBaseUrl(): string {
  const { WHATSAPP_GRAPH_VERSION } = loadEnv()
  return `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`
}

async function postWhatsAppMessage(input: {
  phoneNumberId: string
  accessToken: string
  to: string
  body: Record<string, unknown>
}): Promise<SendMessageResult> {
  const url = `${graphApiBaseUrl()}/${input.phoneNumberId}/messages`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: input.to,
      ...input.body,
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

export async function sendWhatsAppTextMessage(input: {
  to: string
  content: string
  phoneNumberId: string
  accessToken: string
}): Promise<SendMessageResult> {
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

  return postWhatsAppMessage({
    phoneNumberId,
    accessToken,
    to,
    body: {
      type: 'text',
      text: { body: content },
    },
  })
}

export async function sendWhatsAppMediaMessage(input: {
  to: string
  contentType: OutboundMediaContentType
  mediaId: string
  caption?: string
  filename?: string | null
  phoneNumberId: string
  accessToken: string
}): Promise<SendMessageResult> {
  const to = input.to.trim()
  const mediaId = input.mediaId.trim()
  const phoneNumberId = input.phoneNumberId.trim()
  const accessToken = input.accessToken.trim()
  const caption = input.caption?.trim() ?? ''

  if (to.length === 0 || mediaId.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Recipient and media id are required')
  }

  if (phoneNumberId.length === 0 || accessToken.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'WhatsApp is not configured for sending')
  }

  const mediaPayload: Record<string, string> = { id: mediaId }
  if (caption.length > 0 && input.contentType !== 'audio') {
    mediaPayload.caption = caption
  }

  if (input.contentType === 'document') {
    const filename = input.filename?.trim()
    if (filename !== undefined && filename.length > 0) {
      mediaPayload.filename = filename
    }
  }

  return postWhatsAppMessage({
    phoneNumberId,
    accessToken,
    to,
    body: {
      type: input.contentType,
      [input.contentType]: mediaPayload,
    },
  })
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
