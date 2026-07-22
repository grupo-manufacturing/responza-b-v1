import { gmailApiFetch } from './gmailApi.js'
import { parseGmailMessage, type GmailApiMessage, type ParsedGmailMessage } from './parseMessage.js'

export async function getGmailMessage(
  accessToken: string,
  messageId: string,
): Promise<ParsedGmailMessage> {
  const normalizedId = messageId.trim()
  const params = new URLSearchParams()
  params.set('format', 'full')

  const message = await gmailApiFetch<GmailApiMessage>(
    accessToken,
    `users/me/messages/${encodeURIComponent(normalizedId)}?${params.toString()}`,
  )

  const parsed = parseGmailMessage(message, { includeBody: true })

  return {
    ...parsed,
    bodyHtml: parsed.bodyHtml ?? '',
  }
}
