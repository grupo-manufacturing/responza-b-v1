import type { MessageContentType } from '../types.js'

export type WhatsAppInboundEvent = {
  platformMessageId: string
  phoneNumberId: string
  wabaId: string | null
  externalConversationId: string
  displayName: string | null
  contentType: MessageContentType
  body: string | null
  sentAt: string
  metadata: Record<string, unknown>
}

function mapWhatsAppContentType(type: string): MessageContentType {
  if (type === 'text') {
    return 'text'
  }

  if (type === 'image') {
    return 'image'
  }

  if (type === 'video') {
    return 'video'
  }

  if (type === 'audio') {
    return 'audio'
  }

  if (type === 'document') {
    return 'document'
  }

  return 'text'
}

function extractMessageBody(message: Record<string, unknown>): string | null {
  const type = typeof message.type === 'string' ? message.type : 'unknown'

  if (type === 'text') {
    const text = message.text
    if (text !== null && typeof text === 'object' && !Array.isArray(text)) {
      const body = (text as Record<string, unknown>).body
      if (typeof body === 'string' && body.trim().length > 0) {
        return body
      }
    }

    return null
  }

  return `(non-text:${type})`
}

function toIsoTimestamp(rawTimestamp: unknown): string {
  if (typeof rawTimestamp === 'string' && rawTimestamp.trim().length > 0) {
    const asNumber = Number(rawTimestamp)
    if (!Number.isNaN(asNumber) && asNumber > 0) {
      return new Date(asNumber * 1000).toISOString()
    }
  }

  if (typeof rawTimestamp === 'number' && rawTimestamp > 0) {
    return new Date(rawTimestamp * 1000).toISOString()
  }

  return new Date().toISOString()
}

export function parseWhatsAppWebhookPayload(payload: unknown): WhatsAppInboundEvent[] {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return []
  }

  const root = payload as Record<string, unknown>
  if (root.object !== 'whatsapp_business_account') {
    return []
  }

  const entries = Array.isArray(root.entry) ? root.entry : []
  const events: WhatsAppInboundEvent[] = []

  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      continue
    }

    const entryRecord = entry as Record<string, unknown>
    const wabaId = typeof entryRecord.id === 'string' ? entryRecord.id : null
    const changes = Array.isArray(entryRecord.changes) ? entryRecord.changes : []

    for (const change of changes) {
      if (change === null || typeof change !== 'object' || Array.isArray(change)) {
        continue
      }

      const value = (change as Record<string, unknown>).value
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        continue
      }

      const valueRecord = value as Record<string, unknown>
      const metadata =
        valueRecord.metadata !== null &&
        typeof valueRecord.metadata === 'object' &&
        !Array.isArray(valueRecord.metadata)
          ? (valueRecord.metadata as Record<string, unknown>)
          : {}

      const phoneNumberId =
        typeof metadata.phone_number_id === 'string' ? metadata.phone_number_id : null

      if (phoneNumberId === null) {
        continue
      }

      const contacts = Array.isArray(valueRecord.contacts) ? valueRecord.contacts : []
      const contactNames = new Map<string, string>()

      for (const contact of contacts) {
        if (contact === null || typeof contact !== 'object' || Array.isArray(contact)) {
          continue
        }

        const contactRecord = contact as Record<string, unknown>
        const waId = typeof contactRecord.wa_id === 'string' ? contactRecord.wa_id : null
        const profile =
          contactRecord.profile !== null &&
          typeof contactRecord.profile === 'object' &&
          !Array.isArray(contactRecord.profile)
            ? (contactRecord.profile as Record<string, unknown>)
            : null
        const name = profile !== null && typeof profile.name === 'string' ? profile.name.trim() : ''

        if (waId !== null && name.length > 0) {
          contactNames.set(waId, name)
        }
      }

      const messages = Array.isArray(valueRecord.messages) ? valueRecord.messages : []

      for (const message of messages) {
        if (message === null || typeof message !== 'object' || Array.isArray(message)) {
          continue
        }

        const messageRecord = message as Record<string, unknown>
        const platformMessageId = typeof messageRecord.id === 'string' ? messageRecord.id : null
        const from = typeof messageRecord.from === 'string' ? messageRecord.from : null

        if (platformMessageId === null || from === null) {
          continue
        }

        const type = typeof messageRecord.type === 'string' ? messageRecord.type : 'unknown'

        events.push({
          platformMessageId,
          phoneNumberId,
          wabaId,
          externalConversationId: from,
          displayName: contactNames.get(from) ?? null,
          contentType: mapWhatsAppContentType(type),
          body: extractMessageBody(messageRecord),
          sentAt: toIsoTimestamp(messageRecord.timestamp),
          metadata: {
            whatsappType: type,
          },
        })
      }
    }
  }

  return events
}
