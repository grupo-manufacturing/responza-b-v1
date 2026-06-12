import { asRecord, asString } from '../shared/jsonGuards.js'

export type InstagramInboundMessage = {
  businessAccountId: string | null
  from: string
  platformMessageId: string
  content: string
  contactDisplayName: string | null
}

export type InstagramOutboundReadReceipt = {
  businessAccountId: string | null
  platformMessageId: string
}

function messageContent(message: Record<string, unknown>): string {
  const text = asString(message.text)
  if (text !== null) {
    return text
  }

  if (message.attachments && Array.isArray(message.attachments)) {
    const attachment = message.attachments[0]
    if (attachment && typeof attachment === 'object') {
      const attachmentObj = attachment as Record<string, unknown>
      const type = asString(attachmentObj.type)
      return `(attachment:${type || 'unknown'})`
    }
  }

  return '(non-text)'
}

export function parseInstagramInboundMessages(body: unknown): InstagramInboundMessage[] {
  const payload = asRecord(body)
  if (payload === null || payload.object !== 'instagram') {
    return []
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : []
  const inbound: InstagramInboundMessage[] = []

  for (const entryValue of entries) {
    const entry = asRecord(entryValue)
    if (entry === null) {
      continue
    }

    const businessAccountId = asString(entry.id)
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : []

    for (const messageValue of messaging) {
      const messageEvent = asRecord(messageValue)
      if (messageEvent === null) {
        continue
      }

      const sender = asRecord(messageEvent.sender)
      const from = asString(sender?.id)
      const recipient = asRecord(messageEvent.recipient)
      const recipientId = asString(recipient?.id)
      const message = asRecord(messageEvent.message)

      if (from === null || message === null) {
        continue
      }

      if (from === businessAccountId || from === recipientId) {
        continue
      }

      const platformMessageId =
        asString(message.id) ??
        asString(message.mid) ??
        `ig_${Date.now()}_${from}_${Math.random().toString(36).slice(2, 11)}`

      inbound.push({
        businessAccountId,
        from,
        platformMessageId,
        content: messageContent(message),
        contactDisplayName: null,
      })
    }
  }

  return inbound
}

export function parseInstagramOutboundReadReceipts(body: unknown): InstagramOutboundReadReceipt[] {
  const payload = asRecord(body)
  if (payload === null || payload.object !== 'instagram') {
    return []
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : []
  const receipts: InstagramOutboundReadReceipt[] = []

  for (const entryValue of entries) {
    const entry = asRecord(entryValue)
    if (entry === null) {
      continue
    }

    const businessAccountId = asString(entry.id)
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : []

    for (const messageValue of messaging) {
      const messageEvent = asRecord(messageValue)
      if (messageEvent === null) {
        continue
      }

      const sender = asRecord(messageEvent.sender)
      const senderId = asString(sender?.id)
      const recipient = asRecord(messageEvent.recipient)
      const recipientId = asString(recipient?.id)
      const read = asRecord(messageEvent.read)

      if (senderId === null || read === null) {
        continue
      }

      if (senderId === businessAccountId || senderId === recipientId) {
        continue
      }

      const platformMessageId = asString(read.mid)
      if (platformMessageId === null) {
        continue
      }

      receipts.push({
        businessAccountId,
        platformMessageId,
      })
    }
  }

  return receipts
}
