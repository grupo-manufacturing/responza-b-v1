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
import { disconnectGmailIntegration } from '../../platforms/gmail/gmailAuthFailure.js'
import { GMAIL_NOT_CONNECTED_MESSAGE, isGmailRevokedError } from '../../platforms/gmail/gmailErrors.js'
import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import type {
  ListGmailMessagesQuery,
  ReplyGmailMessageBody,
  SendGmailMessageBody,
} from './gmail.schemas.js'

async function withGmailAccess<T>(
  organizationId: string,
  operation: (accessToken: string) => Promise<T>,
): Promise<T> {
  try {
    const accessToken = await ensureValidGmailAccessToken(organizationId)
    return await operation(accessToken)
  } catch (error) {
    if (isGmailRevokedError(error)) {
      await disconnectGmailIntegration(organizationId)
    }

    throw error
  }
}

export async function listMessages(auth: AuthContext, query: ListGmailMessagesQuery) {
  const result = await withGmailAccess(auth.organizationId, (accessToken) =>
    listGmailInboxMessages(accessToken, {
      maxResults: query.maxResults,
      pageToken: query.pageToken,
    }),
  )

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

  const message = await withGmailAccess(auth.organizationId, (accessToken) =>
    getGmailMessage(accessToken, normalizedId),
  )

  return {
    message,
  }
}

async function resolveGmailFromAddress(organizationId: string): Promise<string> {
  const credentials = await getGmailCredentialsForOrganization(organizationId)
  const fromEmail = credentials?.metadata.email?.trim() ?? ''

  if (fromEmail.length === 0) {
    throw new AppError(402, 'INTEGRATIONS_REQUIRED', GMAIL_NOT_CONNECTED_MESSAGE)
  }

  return fromEmail
}

export async function sendMessage(auth: AuthContext, body: SendGmailMessageBody) {
  const sent = await withGmailAccess(auth.organizationId, async (accessToken) => {
    const from = await resolveGmailFromAddress(auth.organizationId)

    return sendGmailMessage(accessToken, {
      from,
      to: body.to,
      subject: body.subject,
      body: body.body,
    })
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

  const sent = await withGmailAccess(auth.organizationId, async (accessToken) => {
    const from = await resolveGmailFromAddress(auth.organizationId)
    const original = await getGmailMessage(accessToken, normalizedId)

    const replyTo = extractEmailAddress(original.from)
    if (replyTo.length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Could not determine the reply recipient')
    }

    return sendGmailMessage(accessToken, {
      from,
      to: replyTo,
      subject: buildReplySubject(original.subject),
      body: body.body,
      threadId: original.threadId,
      inReplyTo: original.messageIdHeader,
      references: buildReplyReferences(original.references, original.messageIdHeader),
    })
  })

  return {
    message: sent,
  }
}
