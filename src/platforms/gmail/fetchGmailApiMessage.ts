import { gmailApiFetch } from './gmailApi.js'
import type { GmailApiMessage } from './parseMessage.js'

export async function fetchGmailApiMessage(
  accessToken: string,
  messageId: string,
  params: URLSearchParams,
): Promise<GmailApiMessage> {
  return gmailApiFetch<GmailApiMessage>(
    accessToken,
    `users/me/messages/${encodeURIComponent(messageId.trim())}?${params.toString()}`,
  )
}
