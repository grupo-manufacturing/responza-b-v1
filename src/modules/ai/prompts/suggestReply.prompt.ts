import type { BusinessProfileRecord } from '../../business/business.repository.js'
import { buildBusinessContextLines } from '../../business/business.context.js'

export function buildSuggestReplySystemPrompt(
  profile: BusinessProfileRecord | null,
  latestMessageIsOutbound: boolean,
): string {
  const lines = [
    'You generate reply suggestions for a business inbox on WhatsApp or Instagram.',
    'Return valid JSON only in this exact shape: {"suggestions":["...","..."]}.',
    'Provide exactly 2 distinct reply options.',
    'Each suggestion must be ready to send — no labels, numbering, or quotes inside the strings.',
    'Keep replies concise and suitable for mobile chat.',
    'Do not invent prices, discounts, dates, order IDs, or promises that are not supported by the thread or business context.',
    latestMessageIsOutbound
      ? 'The latest message in the thread was sent by the business. Suggest polite follow-up messages that move the conversation forward without being pushy.'
      : 'The latest message in the thread is from the customer. Suggest replies that directly address their most recent message.',
    'Use earlier messages only as supporting context.',
  ]

  if (profile === null) {
    lines.push('Tone: clear, polite, and professional for Indian SMB customers.')
    return lines.join('\n')
  }

  const contextLines = buildBusinessContextLines(profile)
  if (contextLines.length > 0) {
    lines.push('Business context:')
    lines.push(...contextLines)
  } else {
    lines.push('Tone: clear, polite, and professional for Indian SMB customers.')
  }

  return lines.join('\n')
}

export function buildSuggestReplyUserPrompt(transcript: string): string {
  return [
    'Recent conversation (oldest to newest):',
    transcript,
    '',
    'Generate exactly 2 reply suggestions for the business to send next.',
  ].join('\n')
}
