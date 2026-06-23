import type { MessageContentType } from '../inbox/inbox.schemas.js'

type MediaContentType = Exclude<MessageContentType, 'text'>

const MEDIA_PREVIEW_LABELS: Record<MediaContentType, string> = {
  image: 'Photo',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
}

function isMediaPlaceholderContent(content: string): boolean {
  const trimmed = content.trim()
  return trimmed.startsWith('(non-text:') || trimmed.startsWith('(attachment:')
}

function inferMediaContentTypeFromPlaceholder(content: string): MediaContentType | null {
  const trimmed = content.trim()

  for (const prefix of ['(attachment:', '(non-text:'] as const) {
    if (!trimmed.startsWith(prefix) || !trimmed.endsWith(')')) {
      continue
    }

    const type = trimmed.slice(prefix.length, -1).trim()
    if (type === 'file') {
      return 'document'
    }

    if (type in MEDIA_PREVIEW_LABELS) {
      return type as MediaContentType
    }
  }

  return null
}

export function formatMessageListPreview(
  content: string,
  contentType: MessageContentType,
): string {
  if (contentType === 'text') {
    const inferred = inferMediaContentTypeFromPlaceholder(content)
    if (inferred !== null) {
      return MEDIA_PREVIEW_LABELS[inferred]
    }

    return content
  }

  const caption = content.trim()
  if (caption.length > 0 && !isMediaPlaceholderContent(caption)) {
    return caption
  }

  return MEDIA_PREVIEW_LABELS[contentType]
}
