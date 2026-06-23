import { asRecord, asString } from '../shared/jsonGuards.js'

export type InstagramInboundContentType = 'text' | 'image' | 'video' | 'audio' | 'document'

export type InstagramInboundMessage = {
  businessAccountId: string | null
  from: string
  platformMessageId: string
  contentType: InstagramInboundContentType
  content: string
  contactDisplayName: string | null
  media?: {
    url: string
    mimeType?: string | null
  }
}

export type InstagramOutboundReadReceipt = {
  businessAccountId: string | null
  platformMessageId: string
}

export type InstagramInboundReaction = {
  businessAccountId: string | null
  targetPlatformMessageId: string
  emoji: string | null
}

export type InstagramOutboundEcho = {
  businessAccountId: string | null
  to: string
  platformMessageId: string
  content: string
}

const INSTAGRAM_ATTACHMENT_TYPES: Record<string, Exclude<InstagramInboundContentType, 'text'>> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  file: 'document',
}

function messageContent(message: Record<string, unknown>): {
  contentType: InstagramInboundContentType
  content: string
  media?: { url: string; mimeType?: string | null }
} {
  const text = asString(message.text)?.trim() ?? ''

  if (message.attachments && Array.isArray(message.attachments)) {
    const attachment = message.attachments[0]
    if (attachment && typeof attachment === 'object') {
      const attachmentObj = attachment as Record<string, unknown>
      const type = asString(attachmentObj.type)
      const payload = asRecord(attachmentObj.payload)
      const url = payload !== null ? asString(payload.url) : null
      const contentType = type !== null ? INSTAGRAM_ATTACHMENT_TYPES[type] : undefined

      if (contentType !== undefined && url !== null) {
        return {
          contentType,
          content: text,
          media: { url },
        }
      }

      return {
        contentType: 'text',
        content: `(attachment:${type || 'unknown'})`,
      }
    }
  }

  if (text.length > 0) {
    return {
      contentType: 'text',
      content: text,
    }
  }

  return {
    contentType: 'text',
    content: '(non-text)',
  }
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

      const parsed = messageContent(message)

      inbound.push({
        businessAccountId,
        from,
        platformMessageId,
        contentType: parsed.contentType,
        content: parsed.content,
        contactDisplayName: null,
        media: parsed.media,
      })
    }
  }

  return inbound
}

export function parseInstagramOutboundEchoes(body: unknown): InstagramOutboundEcho[] {
  const payload = asRecord(body)
  if (payload === null || payload.object !== 'instagram') {
    return []
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : []
  const echoes: InstagramOutboundEcho[] = []

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

      if (messageEvent.read !== undefined || messageEvent.reaction !== undefined) {
        continue
      }

      const sender = asRecord(messageEvent.sender)
      const from = asString(sender?.id)
      const recipient = asRecord(messageEvent.recipient)
      const to = asString(recipient?.id)
      const message = asRecord(messageEvent.message)

      if (from === null || to === null || message === null || businessAccountId === null) {
        continue
      }

      if (from !== businessAccountId || to === businessAccountId) {
        continue
      }

      const platformMessageId = asString(message.id) ?? asString(message.mid)
      if (platformMessageId === null) {
        continue
      }

      echoes.push({
        businessAccountId,
        to,
        platformMessageId,
        content: messageContent(message).content,
      })
    }
  }

  return echoes
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

const INSTAGRAM_REACTION_FALLBACK: Record<string, string> = {
  like: '👍',
  love: '❤️',
  haha: '😂',
  wow: '😀',
  sad: '😊',
  angry: '🔥',
}

export function parseInstagramInboundReactions(body: unknown): InstagramInboundReaction[] {
  const payload = asRecord(body)
  if (payload === null || payload.object !== 'instagram') {
    return []
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : []
  const reactions: InstagramInboundReaction[] = []

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
      const reaction = asRecord(messageEvent.reaction)

      if (senderId === null || reaction === null) {
        continue
      }

      if (senderId === businessAccountId || senderId === recipientId) {
        continue
      }

      const targetPlatformMessageId = asString(reaction.mid)
      if (targetPlatformMessageId === null) {
        continue
      }

      if (asString(reaction.action) === 'unreact') {
        reactions.push({
          businessAccountId,
          targetPlatformMessageId,
          emoji: null,
        })
        continue
      }

      const emoji =
        asString(reaction.emoji) ??
        INSTAGRAM_REACTION_FALLBACK[asString(reaction.reaction) ?? ''] ??
        null

      reactions.push({
        businessAccountId,
        targetPlatformMessageId,
        emoji,
      })
    }
  }

  return reactions
}
