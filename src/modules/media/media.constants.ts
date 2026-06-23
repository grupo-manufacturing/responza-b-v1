/** Maximum inbound media file size (2 MB). */
export const MEDIA_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024

export const INBOUND_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export type InboundImageMimeType = (typeof INBOUND_IMAGE_MIME_TYPES)[number]

const MIME_TO_EXTENSION: Record<InboundImageMimeType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

export function isAllowedInboundImageMimeType(
  mimeType: string,
): mimeType is InboundImageMimeType {
  return (INBOUND_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
}

export function extensionForImageMimeType(mimeType: InboundImageMimeType): string {
  return MIME_TO_EXTENSION[mimeType]
}

export function buildMessageMediaStoragePath(input: {
  organizationId: string
  conversationId: string
  platformMessageId: string
  extension: string
}): string {
  const safePlatformMessageId = input.platformMessageId.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${input.organizationId}/${input.conversationId}/${safePlatformMessageId}.${input.extension}`
}
