import { getGmailCredentialsForOrganization } from '../integrations/credentials.service.js'
import {
  buildReplyReferences,
  buildReplySubject,
  ensureValidGmailAccessToken,
  extractEmailAddress,
  getGmailMessage,
  listGmailInboxMessages,
  sendGmailMessage,
} from '../../platforms/gmail/index.js'
import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import type {
  ListGmailMessagesQuery,
  ReplyGmailMessageBody,
  SendGmailMessageBody,
} from './gmail.schemas.js'

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

async function resolveGmailFromAddress(organizationId: string): Promise<string> {
  const credentials = await getGmailCredentialsForOrganization(organizationId)
  const fromEmail = credentials?.metadata.email?.trim() ?? ''

  if (fromEmail.length === 0) {
    throw new AppError(402, 'INTEGRATIONS_REQUIRED', 'Connect Gmail in Integrations to continue.')
  }

  return fromEmail
}

export async function sendMessage(auth: AuthContext, body: SendGmailMessageBody) {
  const accessToken = await ensureValidGmailAccessToken(auth.organizationId)
  const from = await resolveGmailFromAddress(auth.organizationId)

  const sent = await sendGmailMessage(accessToken, {
    from,
    to: body.to,
    subject: body.subject,
    body: body.body,
  })

  return {
    message: sent,
  }
}

export async function replyToMessage(
  auth: AuthContext,
  messageId: string,
  body: ReplyGmailMessageBody,
) {
  const normalizedId = messageId.trim()
  if (normalizedId.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Message id is required')
  }

  const accessToken = await ensureValidGmailAccessToken(auth.organizationId)
  const from = await resolveGmailFromAddress(auth.organizationId)
  const original = await getGmailMessage(accessToken, normalizedId)

  const replyTo = extractEmailAddress(original.from)
  if (replyTo.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Could not determine the reply recipient')
  }

  const sent = await sendGmailMessage(accessToken, {
    from,
    to: replyTo,
    subject: buildReplySubject(original.subject),
    body: body.body,
    threadId: original.threadId,
    inReplyTo: original.messageIdHeader,
    references: buildReplyReferences(original.references, original.messageIdHeader),
  })

  return {
    message: sent,
  }
}
