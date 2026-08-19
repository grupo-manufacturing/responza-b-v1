import { AppError } from '../../shared/errors/index.js'
import { gmailApiFetch } from './gmailApi.js'
import { buildRawGmailMessage } from './buildRawMessage.js'

type SendGmailMessageInput = {
  from: string
  to: string
  subject: string
  body: string
  threadId?: string
  inReplyTo?: string
  references?: string
}

type SentGmailMessage = {
  id: string
  threadId: string
}

type GmailSendResponse = {
  id?: string
  threadId?: string
}

export async function sendGmailMessage(
  accessToken: string,
  input: SendGmailMessageInput,
): Promise<SentGmailMessage> {
  const raw = buildRawGmailMessage({
    from: input.from,
    to: input.to,
    subject: input.subject,
    body: input.body,
    inReplyTo: input.inReplyTo,
    references: input.references,
  })

  const payload: { raw: string; threadId?: string } = { raw }
  if (input.threadId !== undefined && input.threadId.trim().length > 0) {
    payload.threadId = input.threadId.trim()
  }

  const response = await gmailApiFetch<GmailSendResponse>(accessToken, 'users/me/messages/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const id = response.id?.trim() ?? ''
  const threadId = response.threadId?.trim() ?? ''

  if (id.length === 0 || threadId.length === 0) {
    throw new AppError(502, 'INTERNAL_ERROR', 'Gmail did not return a sent message id')
  }

  return { id, threadId }
}
