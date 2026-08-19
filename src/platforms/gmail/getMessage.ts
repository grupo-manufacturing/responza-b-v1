import { fetchGmailApiMessage } from './fetchGmailApiMessage.js'
import { parseGmailMessage } from './parseMessage.js'

export async function getGmailMessage(accessToken: string, messageId: string) {
  const params = new URLSearchParams()
  params.set('format', 'full')

  const message = await fetchGmailApiMessage(accessToken, messageId, params)
  const parsed = parseGmailMessage(message, { includeBody: true })

  return {
    ...parsed,
    bodyHtml: parsed.bodyHtml ?? '',
  }
}
