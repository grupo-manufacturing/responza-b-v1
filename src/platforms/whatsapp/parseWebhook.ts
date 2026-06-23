import { asRecord, asString } from '../shared/jsonGuards.js'

export type WhatsAppInboundMessage = {
  phoneNumberId: string | null
  wabaId: string | null
  channelDisplayName: string | null
  from: string
  platformMessageId: string
  contentType: 'text' | 'image'
  content: string
  contactDisplayName: string | null
  image?: {
    id: string
    mimeType: string | null
  }
}

export type WhatsAppOutboundReadReceipt = {
  phoneNumberId: string | null
  wabaId: string | null
  platformMessageId: string
}

export type WhatsAppInboundReaction = {
  phoneNumberId: string | null
  wabaId: string | null
  targetPlatformMessageId: string
  emoji: string | null
}

export type WhatsAppOutboundEcho = {
  phoneNumberId: string | null
  wabaId: string | null
  channelDisplayName: string | null
  to: string
  platformMessageId: string
  content: string
  contactDisplayName: string | null
}

function messageContent(message: Record<string, unknown>): {
  contentType: 'text' | 'image'
  content: string
  image?: { id: string; mimeType: string | null }
} {
  const type = asString(message.type) ?? 'unknown'

  if (type === 'image') {
    const image = asRecord(message.image)
    const mediaId = image !== null ? asString(image.id) : null
    const caption = image !== null ? asString(image.caption) : null
    const mimeType = image !== null ? asString(image.mime_type) : null

    if (mediaId !== null) {
      return {
        contentType: 'image',
        content: caption?.trim() ?? '',
        image: {
          id: mediaId,
          mimeType,
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
          image: parsed.image,
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

export function parseWhatsAppInboundReactions(body: unknown): WhatsAppInboundReaction[] {
  const payload = asRecord(body)
  if (payload === null || payload.object !== 'whatsapp_business_account') {
    return []
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : []
  const reactions: WhatsAppInboundReaction[] = []

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
      const messages = Array.isArray(value.messages) ? value.messages : []

      for (const messageValue of messages) {
        const message = asRecord(messageValue)
        if (message === null || asString(message.type) !== 'reaction') {
          continue
        }

        const reaction = asRecord(message.reaction)
        const targetPlatformMessageId = asString(reaction?.message_id)
        if (targetPlatformMessageId === null) {
          continue
        }

        const emoji = asString(reaction?.emoji)
        reactions.push({
          phoneNumberId,
          wabaId,
          targetPlatformMessageId,
          emoji: emoji === null || emoji.length === 0 ? null : emoji,
        })
      }
    }
  }

  return reactions
}
