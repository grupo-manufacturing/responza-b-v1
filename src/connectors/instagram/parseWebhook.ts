export type InstagramInboundMessage = {
  businessAccountId: string | null
  from: string
  platformMessageId: string
  content: string
  contactDisplayName: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function messageContent(message: Record<string, unknown>): string {
  const text = asString(message.text)
  if (text !== null) {
    return text
  }

  // Handle other message types (photos, videos, etc.)
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

      // Extract sender information
      const sender = asRecord(messageEvent.sender)
      const from = asString(sender?.id)
      
      // Extract recipient information to ensure this is an inbound message
      const recipient = asRecord(messageEvent.recipient)
      const recipientId = asString(recipient?.id)

      // Extract message content
      const message = asRecord(messageEvent.message)
      
      if (from === null || message === null) {
        continue
      }

      // Skip if this is an outbound message (sender is our business account)
      if (from === businessAccountId || from === recipientId) {
        continue
      }

      // Generate platform message ID (Instagram doesn't provide one in webhooks like WhatsApp)
      const platformMessageId = `ig_${Date.now()}_${from}_${Math.random().toString(36).substr(2, 9)}`

      inbound.push({
        businessAccountId,
        from,
        platformMessageId,
        content: messageContent(message),
        contactDisplayName: null // Instagram doesn't provide contact names in webhooks
      })
    }
  }

  return inbound
}