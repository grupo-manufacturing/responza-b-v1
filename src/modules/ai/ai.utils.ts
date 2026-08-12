import { ANALYTICS_MAX_MESSAGES } from './ai.constants.js'
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

function formatAnalyticsMessageLine(message: MessageRecord): string {
  const speaker = message.direction === 'inbound' ? 'Customer' : 'You'
  const timestamp = message.created_at.slice(0, 16).replace('T', ' ')
  return `[${timestamp}] ${speaker}: ${formatMessageContentForAi(message.content)}`
}

export function buildAnalyticsTranscript(messages: MessageRecord[]): {
  transcript: string
  omittedOlderMessageCount: number
} {
  const omittedOlderMessageCount =
    messages.length > ANALYTICS_MAX_MESSAGES ? messages.length - ANALYTICS_MAX_MESSAGES : 0

  const visibleMessages =
    omittedOlderMessageCount > 0 ? messages.slice(omittedOlderMessageCount) : messages

  return {
    transcript: visibleMessages.map(formatAnalyticsMessageLine).join('\n'),
    omittedOlderMessageCount,
  }
}
