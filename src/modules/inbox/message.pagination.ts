export const DEFAULT_MESSAGE_PAGE_SIZE = 50
export const MAX_MESSAGE_PAGE_SIZE = 100

export type MessageListCursor = {
  createdAt: string
  id: string
}

export function encodeMessageListCursor(cursor: MessageListCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url')
}

export function decodeMessageListCursor(encoded: string): MessageListCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as MessageListCursor).createdAt !== 'string' ||
      typeof (parsed as MessageListCursor).id !== 'string'
    ) {
      return null
    }

    return parsed as MessageListCursor
  } catch {
    return null
  }
}

export function messageListBeforeCursorFilter(cursor: MessageListCursor): string {
  const at = cursor.createdAt.replaceAll('"', '\\"')
  const id = cursor.id.replaceAll('"', '\\"')
  return `created_at.lt."${at}",and(created_at.eq."${at}",id.lt."${id}")`
}
