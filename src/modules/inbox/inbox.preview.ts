import type { MessageContentType } from '../inbox/inbox.schemas.js'

export function formatMessageListPreview(
  content: string,
  contentType: MessageContentType,
): string {
  if (contentType === 'image') {
    const caption = content.trim()
    return caption.length > 0 ? caption : 'Photo'
  }

  return content
}
