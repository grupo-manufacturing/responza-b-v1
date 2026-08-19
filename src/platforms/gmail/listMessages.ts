import { gmailApiFetch } from './gmailApi.js'
import { fetchGmailApiMessage } from './fetchGmailApiMessage.js'
import { parseGmailMessage } from './parseMessage.js'

type GmailMessagesListResponse = {
  messages?: Array<{ id?: string; threadId?: string }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

type GmailMessageListItem = {
  id: string
  from: string
  to: string
  subject: string
  snippet: string
  receivedAt: string
}

type GmailListMessagesResult = {
  messages: GmailMessageListItem[]
  nextPageToken: string | null
}

export async function listGmailInboxMessages(
  accessToken: string,
  input: {
    maxResults: number
    pageToken?: string
  },
): Promise<GmailListMessagesResult> {
  const params = new URLSearchParams()
  params.set('labelIds', 'INBOX')
  params.set('maxResults', String(input.maxResults))
  if (input.pageToken !== undefined && input.pageToken.length > 0) {
    params.set('pageToken', input.pageToken)
  }

  const listResponse = await gmailApiFetch<GmailMessagesListResponse>(
    accessToken,
    `users/me/messages?${params.toString()}`,
  )

  const messageIds = (listResponse.messages ?? [])
    .map((message) => message.id?.trim() ?? '')
    .filter((id) => id.length > 0)

  const messages = await Promise.all(
    messageIds.map(async (id) => {
      const detailParams = new URLSearchParams()
      detailParams.set('format', 'metadata')
      detailParams.append('metadataHeaders', 'From')
      detailParams.append('metadataHeaders', 'To')
      detailParams.append('metadataHeaders', 'Subject')

      const message = await fetchGmailApiMessage(accessToken, id, detailParams)

      const parsed = parseGmailMessage(message)
      return {
        id: parsed.id,
        from: parsed.from,
        to: parsed.to,
        subject: parsed.subject,
        snippet: parsed.snippet,
        receivedAt: parsed.receivedAt,
      }
    }),
  )

  return {
    messages,
    nextPageToken: listResponse.nextPageToken?.trim() || null,
  }
}
