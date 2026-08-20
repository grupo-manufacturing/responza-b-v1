import type { AuthContext } from '../../../shared/auth/index.js'
import * as gmailService from '../../gmail/gmail.service.js'
import {
  ASSISTANT_LIST_GMAIL_DEFAULT_LIMIT,
  ASSISTANT_LIST_GMAIL_MAX_LIMIT,
} from '../assistant.constants.js'

export type ListGmailMessagesToolInput = {
  limit?: number
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return ASSISTANT_LIST_GMAIL_DEFAULT_LIMIT
  }

  return Math.min(Math.max(1, limit), ASSISTANT_LIST_GMAIL_MAX_LIMIT)
}

export async function listGmailMessagesForAssistant(
  auth: AuthContext,
  input: ListGmailMessagesToolInput,
) {
  const limit = clampLimit(input.limit)
  const result = await gmailService.listMessages(auth, { maxResults: limit })

  return {
    count: result.messages.length,
    hasMore: result.nextPageToken !== null,
    messages: result.messages.map((message) => ({
      id: message.id,
      from: message.from,
      subject: message.subject,
      snippet: message.snippet,
      receivedAt: message.receivedAt,
      gmailPath: `/gmail?message=${encodeURIComponent(message.id)}`,
    })),
  }
}

export const listGmailMessagesToolDefinition = {
  type: 'function' as const,
  function: {
    name: 'list_gmail_messages',
    description:
      'Lists recent emails from the connected Gmail inbox, newest first. Use for questions about recent mail, unread-looking items, or inbox overview.',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: ASSISTANT_LIST_GMAIL_MAX_LIMIT,
          description: 'Max emails to return.',
        },
      },
      additionalProperties: false,
    },
  },
}
