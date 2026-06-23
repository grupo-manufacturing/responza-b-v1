import type { MessageContentType } from '../inbox/inbox.schemas.js'

/** Maximum inbound media file size (2 MB). */
export const MEDIA_MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024

export const INBOUND_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export const INBOUND_VIDEO_MIME_TYPES = ['video/mp4', 'video/3gpp', 'video/quicktime'] as const

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

const GENERIC_MIME_TYPES = new Set(['application/octet-stream', 'binary/octet-stream', ''])

const DEFAULT_STORAGE_MIME: Record<InboundMediaContentType, string> = {
  image: 'image/jpeg',
  video: 'video/mp4',
  audio: 'audio/mpeg',
  document: 'application/pdf',
}

const MIME_TO_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'video/quicktime': 'mov',
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

const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  '3gp': 'video/3gpp',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp3: 'audio/mpeg',
  amr: 'audio/amr',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  txt: 'text/plain',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

const ALLOWED_MIME_TYPES_BY_CONTENT_TYPE: Record<InboundMediaContentType, readonly string[]> = {
  image: INBOUND_IMAGE_MIME_TYPES,
  video: INBOUND_VIDEO_MIME_TYPES,
  audio: INBOUND_AUDIO_MIME_TYPES,
  document: INBOUND_DOCUMENT_MIME_TYPES,
}

export function normalizeMimeType(mimeType: string): string {
  return mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
}

export function isAllowedInboundMediaMimeType(
  contentType: InboundMediaContentType,
  mimeType: string,
): boolean {
  const normalized = normalizeMimeType(mimeType)
  if (GENERIC_MIME_TYPES.has(normalized)) {
    return true
  }

  return ALLOWED_MIME_TYPES_BY_CONTENT_TYPE[contentType].includes(normalized)
}

export function inferMimeTypeFromFilename(filename: string | null | undefined): string | null {
  if (filename === null || filename === undefined) {
    return null
  }

  const trimmed = filename.trim()
  const extension = trimmed.includes('.') ? trimmed.split('.').pop()?.toLowerCase() : undefined
  if (extension === undefined || extension.length === 0) {
    return null
  }

  return EXTENSION_TO_MIME[extension] ?? null
}

export function inferMimeTypeFromUrl(mediaUrl: string | null | undefined): string | null {
  if (mediaUrl === null || mediaUrl === undefined) {
    return null
  }

  const path = mediaUrl.split('?')[0] ?? ''
  const filename = path.split('/').pop()
  return inferMimeTypeFromFilename(filename)
}

export function resolveStorageMimeType(input: {
  contentType: InboundMediaContentType
  downloadedMime: string
  mimeTypeHint: string | null
  filename?: string | null
  mediaUrl?: string | null
}): string | null {
  const candidates = [
    normalizeMimeType(input.downloadedMime),
    input.mimeTypeHint !== null ? normalizeMimeType(input.mimeTypeHint) : '',
    inferMimeTypeFromFilename(input.filename) ?? '',
    inferMimeTypeFromUrl(input.mediaUrl) ?? '',
  ].filter((mime) => mime.length > 0)

  for (const mime of candidates) {
    if (GENERIC_MIME_TYPES.has(mime)) {
      continue
    }

    if (mime === 'video/quicktime' && input.contentType === 'video') {
      return 'video/quicktime'
    }

    if (ALLOWED_MIME_TYPES_BY_CONTENT_TYPE[input.contentType].includes(mime)) {
      return mime
    }
  }

  const defaultMime = DEFAULT_STORAGE_MIME[input.contentType]
  if (ALLOWED_MIME_TYPES_BY_CONTENT_TYPE[input.contentType].includes(defaultMime)) {
    return defaultMime
  }

  return null
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
  const normalizedMimeType = normalizeMimeType(mimeType)
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
