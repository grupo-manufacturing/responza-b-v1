import type { MessageContentType } from '../inbox/inbox.schemas.js'

const MEDIA_PREVIEW_LABELS: Record<Exclude<MessageContentType, 'text'>, string> = {
  image: 'Photo',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
}

export function formatMessageListPreview(
  content: string,
  contentType: MessageContentType,
): string {
  if (contentType === 'text') {
    return content
  }

  const caption = content.trim()
  return caption.length > 0 ? caption : MEDIA_PREVIEW_LABELS[contentType]
}
