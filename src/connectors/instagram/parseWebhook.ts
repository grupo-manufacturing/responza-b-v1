export type InstagramInboundEvent = {
  entryId: string | null
  recipientId: string | null
  senderId: string
  platformMessageId: string
  content: string
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
  const rawText = message.text
  if (typeof rawText === 'string' && rawText.trim().length > 0) {
    return rawText.trim()
  }

  if (rawText !== undefined && rawText !== null) {
    return JSON.stringify(rawText)
  }

  return '(non-text)'
}

export function parseInstagramInboundEvents(body: unknown): InstagramInboundEvent[] {
  const payload = asRecord(body)
  if (payload === null || payload.object !== 'instagram') {
    return []
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : []
  const inbound: InstagramInboundEvent[] = []

  for (const entryValue of entries) {
    const entry = asRecord(entryValue)
    if (entry === null) {
      continue
    }

    const entryId = asString(entry.id)
    const messaging = Array.isArray(entry.messaging) ? entry.messaging : []

    for (const eventValue of messaging) {
      const event = asRecord(eventValue)
      if (event === null) {
        continue
      }

      const message = asRecord(event.message)
      const senderId = asString(asRecord(event.sender)?.id)
      if (message === null || senderId === null) {
        continue
      }

      const platformMessageId = asString(message.mid)
      if (platformMessageId === null) {
        continue
      }

      inbound.push({
        entryId,
        recipientId: asString(asRecord(event.recipient)?.id),
        senderId,
        platformMessageId,
        content: messageContent(message),
      })
    }
  }

  return inbound
}
