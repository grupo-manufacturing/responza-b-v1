import { decodeCursor, encodeCursor, escapeCursorValue } from './cursor.pagination.js'

export const DEFAULT_MESSAGE_PAGE_SIZE = 50
export const MAX_MESSAGE_PAGE_SIZE = 100

export type MessageListCursor = {
  createdAt: string
  id: string
}

const MESSAGE_LIST_CURSOR_KEYS = ['createdAt', 'id'] as const satisfies readonly (keyof MessageListCursor)[]

export function encodeMessageListCursor(cursor: MessageListCursor): string {
  return encodeCursor(cursor)
}

export function decodeMessageListCursor(encoded: string): MessageListCursor | null {
  return decodeCursor<MessageListCursor>(encoded, MESSAGE_LIST_CURSOR_KEYS)
}

export function messageListBeforeCursorFilter(cursor: MessageListCursor): string {
  const at = escapeCursorValue(cursor.createdAt)
  const id = escapeCursorValue(cursor.id)
  return `created_at.lt."${at}",and(created_at.eq."${at}",id.lt."${id}")`
}
