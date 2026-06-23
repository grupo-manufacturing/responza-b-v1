import type { MessageContentType } from '../inbox/inbox.schemas.js'

/** Maximum inbound media file size (2 MB). */
export const MEDIA_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024

export const INBOUND_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export const INBOUND_VIDEO_MIME_TYPES = ['video/mp4', 'video/3gpp'] as const

export const INBOUND_AUDIO_MIME_TYPES = [
  'audio/aac',
  'audio/mp4',
  'audio/mpeg',
  'audio/amr',
  'audio/ogg',
  'audio/opus',
] as const

export const INBOUND_DOCUMENT_MIME_TYPES = [
  'text/plain',
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const

export type InboundImageMimeType = (typeof INBOUND_IMAGE_MIME_TYPES)[number]
export type InboundVideoMimeType = (typeof INBOUND_VIDEO_MIME_TYPES)[number]
export type InboundAudioMimeType = (typeof INBOUND_AUDIO_MIME_TYPES)[number]
export type InboundDocumentMimeType = (typeof INBOUND_DOCUMENT_MIME_TYPES)[number]

export type InboundMediaContentType = Exclude<MessageContentType, 'text'>

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/amr': 'amr',
  'audio/ogg': 'ogg',
  'audio/opus': 'opus',
  'text/plain': 'txt',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

const ALLOWED_MIME_TYPES_BY_CONTENT_TYPE: Record<InboundMediaContentType, readonly string[]> = {
  image: INBOUND_IMAGE_MIME_TYPES,
  video: INBOUND_VIDEO_MIME_TYPES,
  audio: INBOUND_AUDIO_MIME_TYPES,
  document: INBOUND_DOCUMENT_MIME_TYPES,
}

export function isAllowedInboundMediaMimeType(
  contentType: InboundMediaContentType,
  mimeType: string,
): boolean {
  return ALLOWED_MIME_TYPES_BY_CONTENT_TYPE[contentType].includes(mimeType)
}

export function isAllowedInboundImageMimeType(
  mimeType: string,
): mimeType is InboundImageMimeType {
  return isAllowedInboundMediaMimeType('image', mimeType)
}

export function extensionForImageMimeType(mimeType: InboundImageMimeType): string {
  return extensionForMediaMimeType('image', mimeType)
}

export function extensionForMediaMimeType(
  contentType: InboundMediaContentType,
  mimeType: string,
): string {
  const normalizedMimeType = mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  const mapped = MIME_TO_EXTENSION[normalizedMimeType]
  if (mapped !== undefined) {
    return mapped
  }

  return contentType
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
