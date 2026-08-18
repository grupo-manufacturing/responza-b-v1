import { asRecord, asString } from '../shared/jsonGuards.js'

export type WhatsAppInboundContentType = 'text' | 'image' | 'video' | 'audio' | 'document'

type WhatsAppInboundMessage = {
  phoneNumberId: string | null
  wabaId: string | null
  channelDisplayName: string | null
  from: string
  platformMessageId: string
  contentType: WhatsAppInboundContentType
  content: string
  contactDisplayName: string | null
  media?: {
    id: string
    mimeType: string | null
    filename?: string | null
  }
}

type WhatsAppOutboundReadReceipt = {
  phoneNumberId: string | null
  wabaId: string | null
  platformMessageId: string
}

type WhatsAppOutboundEcho = {
  phoneNumberId: string | null
  wabaId: string | null
  channelDisplayName: string | null
  to: string
  platformMessageId: string
  content: string
  contactDisplayName: string | null
}

const WHATSAPP_MEDIA_TYPES: Record<string, Exclude<WhatsAppInboundContentType, 'text'>> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  voice: 'audio',
  document: 'document',
  sticker: 'image',
}

function messageContent(message: Record<string, unknown>): {
  contentType: WhatsAppInboundContentType
  content: string
  media?: { id: string; mimeType: string | null; filename?: string | null }
} {
  const type = asString(message.type) ?? 'unknown'
  const mediaContentType = WHATSAPP_MEDIA_TYPES[type]

  if (mediaContentType !== undefined) {
    const mediaRecord = asRecord(message[type])
    const mediaId = mediaRecord !== null ? asString(mediaRecord.id) : null
    const caption = mediaRecord !== null ? asString(mediaRecord.caption) : null
    const mimeType = mediaRecord !== null ? asString(mediaRecord.mime_type) : null
    const filename = mediaRecord !== null ? asString(mediaRecord.filename) : null

    if (mediaId !== null) {
      const trimmedCaption = caption?.trim() ?? ''
      const trimmedFilename = filename?.trim() ?? ''

      return {
        contentType: mediaContentType,
        content: trimmedCaption.length > 0 ? trimmedCaption : trimmedFilename,
        media: {
          id: mediaId,
          mimeType,
          filename: trimmedFilename.length > 0 ? trimmedFilename : null,
        },
      }
    }
  }

  const textBody = asRecord(message.text)?.body
  if (typeof textBody === 'string' && textBody.trim().length > 0) {
    return {
      contentType: 'text',
      content: textBody.trim(),
    }
  }

  return {
    contentType: 'text',
    content: `(non-text:${type})`,
  }
}

function contactNamesByWaId(contacts: unknown): Map<string, string> {
  const names = new Map<string, string>()
  if (!Array.isArray(contacts)) {
    return names
  }

  for (const item of contacts) {
    const contact = asRecord(item)
    if (contact === null) {
      continue
    }

    const waId = asString(contact.wa_id)
    if (waId === null) {
      continue
    }

    const profileName = asString(asRecord(contact.profile)?.name)
    if (profileName !== null) {
      names.set(waId, profileName)
    }
  }

  return names
}

export function parseWhatsAppInboundMessages(body: unknown): WhatsAppInboundMessage[] {
  const payload = asRecord(body)
  if (payload === null || payload.object !== 'whatsapp_business_account') {
    return []
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : []
  const inbound: WhatsAppInboundMessage[] = []

  for (const entryValue of entries) {
    const entry = asRecord(entryValue)
    if (entry === null) {
      continue
    }

    const wabaId = asString(entry.id)
    const changes = Array.isArray(entry.changes) ? entry.changes : []

    for (const changeValue of changes) {
      const change = asRecord(changeValue)
      if (change === null) {
        continue
      }

      const value = asRecord(change.value)
      if (value === null) {
        continue
      }

      const metadata = asRecord(value.metadata)
      const phoneNumberId = asString(metadata?.phone_number_id)
      const channelDisplayName = asString(metadata?.display_phone_number)
      const contactNames = contactNamesByWaId(value.contacts)
      const messages = Array.isArray(value.messages) ? value.messages : []

      for (const messageValue of messages) {
        const message = asRecord(messageValue)
        if (message === null) {
          continue
        }

        if (asString(message.type) === 'reaction') {
          continue
        }

        const from = asString(message.from)
        const platformMessageId = asString(message.id)
        if (from === null || platformMessageId === null) {
          continue
        }

        const parsed = messageContent(message)

        inbound.push({
          phoneNumberId,
          wabaId,
          channelDisplayName,
          from,
          platformMessageId,
          contentType: parsed.contentType,
          content: parsed.content,
          contactDisplayName: contactNames.get(from) ?? null,
          media: parsed.media,
        })
      }
    }
  }

  return inbound
}

function readWhatsAppEchoMessages(value: Record<string, unknown>): unknown[] {
  if (Array.isArray(value.message_echoes)) {
    return value.message_echoes
  }

  if (Array.isArray(value.smb_message_echoes)) {
    return value.smb_message_echoes
  }

  return []
}

export function parseWhatsAppOutboundEchoes(body: unknown): WhatsAppOutboundEcho[] {
  const payload = asRecord(body)
  if (payload === null || payload.object !== 'whatsapp_business_account') {
    return []
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : []
  const echoes: WhatsAppOutboundEcho[] = []

  for (const entryValue of entries) {
    const entry = asRecord(entryValue)
    if (entry === null) {
      continue
    }

    const wabaId = asString(entry.id)
    const changes = Array.isArray(entry.changes) ? entry.changes : []

    for (const changeValue of changes) {
      const change = asRecord(changeValue)
      if (change === null) {
        continue
      }

      const field = asString(change.field)
      if (field !== null && field !== 'smb_message_echoes') {
        continue
      }

      const value = asRecord(change.value)
      if (value === null) {
        continue
      }

      const metadata = asRecord(value.metadata)
      const phoneNumberId = asString(metadata?.phone_number_id)
      const channelDisplayName = asString(metadata?.display_phone_number)
      const contactNames = contactNamesByWaId(value.contacts)
      const echoMessages = readWhatsAppEchoMessages(value)

      for (const messageValue of echoMessages) {
        const message = asRecord(messageValue)
        if (message === null) {
          continue
        }

        if (asString(message.type) === 'reaction') {
          continue
        }

        const to = asString(message.to)
        const platformMessageId = asString(message.id)
        if (to === null || platformMessageId === null) {
          continue
        }

        echoes.push({
          phoneNumberId,
          wabaId,
          channelDisplayName,
          to,
          platformMessageId,
          content: messageContent(message).content,
          contactDisplayName: contactNames.get(to) ?? null,
        })
      }
    }
  }

  return echoes
}

export function parseWhatsAppOutboundReadReceipts(body: unknown): WhatsAppOutboundReadReceipt[] {
  const payload = asRecord(body)
  if (payload === null || payload.object !== 'whatsapp_business_account') {
    return []
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : []
  const receipts: WhatsAppOutboundReadReceipt[] = []

  for (const entryValue of entries) {
    const entry = asRecord(entryValue)
    if (entry === null) {
      continue
    }

    const wabaId = asString(entry.id)
    const changes = Array.isArray(entry.changes) ? entry.changes : []

    for (const changeValue of changes) {
      const change = asRecord(changeValue)
      if (change === null) {
        continue
      }

      const value = asRecord(change.value)
      if (value === null) {
        continue
      }

      const metadata = asRecord(value.metadata)
      const phoneNumberId = asString(metadata?.phone_number_id)
      const statuses = Array.isArray(value.statuses) ? value.statuses : []

      for (const statusValue of statuses) {
        const status = asRecord(statusValue)
        if (status === null) {
          continue
        }

        if (asString(status.status) !== 'read') {
          continue
        }

        const platformMessageId = asString(status.id)
        if (platformMessageId === null) {
          continue
        }

        receipts.push({
          phoneNumberId,
          wabaId,
          platformMessageId,
        })
      }
    }
  }

  return receipts
}
