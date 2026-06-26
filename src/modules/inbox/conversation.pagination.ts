export const DEFAULT_CONVERSATION_LIST_LIMIT = 30
export const MAX_CONVERSATION_LIST_LIMIT = 100

export type ConversationListCursor = {
  lastMessageAt: string
  id: string
}

export function encodeConversationListCursor(cursor: ConversationListCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeConversationListCursor(encoded: string): ConversationListCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as ConversationListCursor).lastMessageAt !== 'string' ||
      typeof (parsed as ConversationListCursor).id !== 'string'
    ) {
      return null
    }

    return parsed as ConversationListCursor
  } catch {
    return null
  }
}

export function conversationListCursorFilter(cursor: ConversationListCursor): string {
  const at = cursor.lastMessageAt.replaceAll('"', '\\"')
  const id = cursor.id.replaceAll('"', '\\"')
  return `last_message_at.lt."${at}",and(last_message_at.eq."${at}",id.lt."${id}")`
}
