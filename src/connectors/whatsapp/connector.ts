import type { IConnector } from '../interface.js'
import type { IncomingMessage, OutboundMessage, ParticipantProfile } from '../types.js'
import {
  exchangeEmbeddedSignupCode,
  sendWhatsAppTextMessage,
  type WhatsAppCredentials,
} from './meta-api.js'
import { parseWhatsAppWebhookPayload } from './webhook-parser.js'
import { verifyWhatsAppWebhookSignature } from './signature.js'

export class WhatsAppConnector implements IConnector {
  constructor(private readonly credentials?: WhatsAppCredentials) {}

  async validateCredentials(credentials: unknown): Promise<boolean> {
    const parsed = credentials as WhatsAppCredentials | null
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      typeof parsed.accessToken !== 'string' ||
      parsed.accessToken.length === 0 ||
      typeof parsed.phoneNumberId !== 'string' ||
      parsed.phoneNumberId.length === 0
    ) {
      return false
    }

    return true
  }

  verifyWebhookSignature(signature: string, body: string): boolean {
    return verifyWhatsAppWebhookSignature(signature, body)
  }

  async parseIncomingMessage(payload: unknown): Promise<IncomingMessage> {
    const events = parseWhatsAppWebhookPayload(payload)
    const first = events[0]

    if (first === undefined) {
      throw new Error('No WhatsApp messages found in webhook payload')
    }

    return {
      platformMessageId: first.platformMessageId,
      externalConversationId: first.externalConversationId,
      participant: {
        platformUserId: first.externalConversationId,
        displayName: first.displayName,
        avatarUrl: null,
      },
      direction: 'inbound',
      contentType: first.contentType,
      body: first.body,
      fileUrl: null,
      metadata: first.metadata,
      sentAt: first.sentAt,
    }
  }

  async sendMessage(message: OutboundMessage): Promise<{ platformMessageId: string }> {
    if (this.credentials === undefined) {
      throw new Error('WhatsApp credentials are required to send messages')
    }

    if (message.contentType !== 'text') {
      throw new Error('Only text outbound messages are supported in Phase 5')
    }

    const body = message.body?.trim() ?? ''
    if (body.length === 0) {
      throw new Error('Message body is required')
    }

    return sendWhatsAppTextMessage(this.credentials, {
      to: message.externalConversationId,
      body,
    })
  }

  async fetchProfile(_participantId: string): Promise<ParticipantProfile> {
    throw new Error('fetchProfile is not implemented for WhatsApp in Phase 5')
  }

  async fetchMedia(_mediaUrl: string): Promise<Buffer> {
    throw new Error('fetchMedia is not implemented for WhatsApp in Phase 5')
  }
}

export function createWhatsAppConnector(credentials: WhatsAppCredentials): WhatsAppConnector {
  return new WhatsAppConnector(credentials)
}

export async function exchangeWhatsAppConnectCode(code: string): Promise<string> {
  return exchangeEmbeddedSignupCode(code)
}

export { parseWhatsAppWebhookPayload } from './webhook-parser.js'
export { verifyWhatsAppWebhookSignature } from './signature.js'
