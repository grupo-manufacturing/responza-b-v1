import {
  ensureValidGmailAccessToken,
  getGmailMessage,
  listGmailInboxMessages,
} from '../../platforms/gmail/index.js'
import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { ListGmailMessagesQuery } from './gmail.schemas.js'

export async function listMessages(auth: AuthContext, query: ListGmailMessagesQuery) {
  const accessToken = await ensureValidGmailAccessToken(auth.organizationId)

  const result = await listGmailInboxMessages(accessToken, {
    maxResults: query.maxResults,
    pageToken: query.pageToken,
  })

  return {
    messages: result.messages,
    nextPageToken: result.nextPageToken,
  }
}

export async function getMessage(auth: AuthContext, messageId: string) {
  const normalizedId = messageId.trim()
  if (normalizedId.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Message id is required')
  }

  const accessToken = await ensureValidGmailAccessToken(auth.organizationId)
  const message = await getGmailMessage(accessToken, normalizedId)

  return {
    message,
  }
}
