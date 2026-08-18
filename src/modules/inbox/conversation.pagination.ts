import { decodeCursor, encodeCursor, escapeCursorValue } from './cursor.pagination.js'

export const DEFAULT_CONVERSATION_LIST_LIMIT = 30
export const MAX_CONVERSATION_LIST_LIMIT = 100

export type ConversationListCursor = {
  lastMessageAt: string
  id: string
}

const CONVERSATION_LIST_CURSOR_KEYS = ['lastMessageAt', 'id'] as const satisfies readonly (keyof ConversationListCursor)[]

export function encodeConversationListCursor(cursor: ConversationListCursor): string {
  return encodeCursor(cursor)
}

export function decodeConversationListCursor(encoded: string): ConversationListCursor | null {
  return decodeCursor<ConversationListCursor>(encoded, CONVERSATION_LIST_CURSOR_KEYS)
}

export function conversationListCursorFilter(cursor: ConversationListCursor): string {
  const at = escapeCursorValue(cursor.lastMessageAt)
  const id = escapeCursorValue(cursor.id)
  return `last_message_at.lt."${at}",and(last_message_at.eq."${at}",id.lt."${id}")`
}
