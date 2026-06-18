import type { MessageRecord } from '../inbox/repositories/types.js'

export function isTranslatableMessageContent(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length === 0) {
    return false
  }

  if (trimmed.startsWith('(non-text:')) {
    return false
  }

  if (trimmed.startsWith('(attachment:')) {
    return false
  }

  return true
}

export function formatMessageContentForAi(content: string): string {
  const trimmed = content.trim()
  if (trimmed.length === 0) {
    return '[empty message]'
  }

  if (trimmed.startsWith('(non-text:')) {
    const type = trimmed.slice('(non-text:'.length).replace(')', '').trim() || 'media'
    return `[${type}]`
  }

  if (trimmed.startsWith('(attachment:')) {
    const type = trimmed.slice('(attachment:'.length).replace(')', '').trim() || 'attachment'
    return `[${type}]`
  }

  return trimmed
}

export function formatMessageLine(message: MessageRecord): string {
  const speaker = message.direction === 'inbound' ? 'Customer' : 'You'
  return `${speaker}: ${formatMessageContentForAi(message.content)}`
}

export function buildSuggestReplyTranscript(messages: MessageRecord[]): string {
  return messages.map(formatMessageLine).join('\n')
}

export function isLatestMessageOutbound(messages: MessageRecord[]): boolean {
  const latest = messages[messages.length - 1]
  return latest?.direction === 'outbound'
}
