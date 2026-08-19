import {
  buildReplyReferences,
  buildReplySubject,
  ensureGmailAccessContext,
  extractEmailAddress,
  getGmailMessage,
  listGmailInboxMessages,
  sendGmailMessage,
} from '../../platforms/gmail/index.js'
import { disconnectGmailIntegration } from '../../platforms/gmail/gmailAuthFailure.js'
import { isGmailRevokedError } from '../../platforms/gmail/gmailErrors.js'
import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import type {
  ListGmailMessagesQuery,
  ReplyGmailMessageBody,
  SendGmailMessageBody,
} from './gmail.schemas.js'

function requireMessageId(messageId: string): string {
  const normalizedId = messageId.trim()
  if (normalizedId.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Message id is required')
  }

  return normalizedId
}

async function withGmailAccess<T>(
  organizationId: string,
  operation: (context: { accessToken: string; fromEmail: string }) => Promise<T>,
): Promise<T> {
  try {
    const context = await ensureGmailAccessContext(organizationId)
    return await operation(context)
  } catch (error) {
    if (isGmailRevokedError(error)) {
      await disconnectGmailIntegration(organizationId)
    }

    throw error
  }
}

export async function listMessages(auth: AuthContext, query: ListGmailMessagesQuery) {
  return withGmailAccess(auth.organizationId, ({ accessToken }) =>
    listGmailInboxMessages(accessToken, {
      maxResults: query.maxResults,
      pageToken: query.pageToken,
    }),
  )
}

export async function getMessage(auth: AuthContext, messageId: string) {
  const normalizedId = requireMessageId(messageId)
  const message = await withGmailAccess(auth.organizationId, ({ accessToken }) =>
    getGmailMessage(accessToken, normalizedId),
  )

  return { message }
}

export async function sendMessage(auth: AuthContext, body: SendGmailMessageBody) {
  const sent = await withGmailAccess(auth.organizationId, ({ accessToken, fromEmail }) =>
    sendGmailMessage(accessToken, {
      from: fromEmail,
      to: body.to,
      subject: body.subject,
      body: body.body,
    }),
  )

  return { message: sent }
}

export async function replyToMessage(
  auth: AuthContext,
  messageId: string,
  body: ReplyGmailMessageBody,
) {
  const normalizedId = requireMessageId(messageId)

  const sent = await withGmailAccess(auth.organizationId, async ({ accessToken, fromEmail }) => {
    const original = await getGmailMessage(accessToken, normalizedId)

    const replyTo = extractEmailAddress(original.from)
    if (replyTo.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Could not determine the reply recipient')
    }

    return sendGmailMessage(accessToken, {
      from: fromEmail,
      to: replyTo,
      subject: buildReplySubject(original.subject),
      body: body.body,
      threadId: original.threadId,
      inReplyTo: original.messageIdHeader,
      references: buildReplyReferences(original.references, original.messageIdHeader),
    })
  })

  return { message: sent }
}
