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

const ALL_INBOUND_MIME_TYPES = new Set<string>([
  ...INBOUND_IMAGE_MIME_TYPES,
  ...INBOUND_VIDEO_MIME_TYPES,
  ...INBOUND_AUDIO_MIME_TYPES,
  ...INBOUND_DOCUMENT_MIME_TYPES,
])

export function sniffMimeTypeFromBuffer(buffer: Buffer): string | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf'
  }

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png'
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }

  if (buffer.length >= 6 && buffer.toString('ascii', 0, 3) === 'GIF') {
    return 'image/gif'
  }

  if (buffer.length >= 8 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return 'video/mp4'
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }

  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) {
    return 'application/msword'
  }

  return null
}

function mimeAllowedForStorage(
  contentType: InboundMediaContentType,
  mime: string,
): boolean {
  if (ALLOWED_MIME_TYPES_BY_CONTENT_TYPE[contentType].includes(mime)) {
    return true
  }

  // Instagram "file" attachments are not always PDFs.
  if (contentType === 'document' && ALL_INBOUND_MIME_TYPES.has(mime)) {
    return true
  }

  return false
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
  sniffedMime?: string | null
}): string | null {
  const sniffed = input.sniffedMime !== null && input.sniffedMime !== undefined
    ? normalizeMimeType(input.sniffedMime)
    : null

  if (sniffed !== null && sniffed.length > 0 && mimeAllowedForStorage(input.contentType, sniffed)) {
    return sniffed
  }

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

    if (mimeAllowedForStorage(input.contentType, mime)) {
      return mime
    }
  }

  if (input.contentType === 'document') {
    return null
  }

  const defaultMime = DEFAULT_STORAGE_MIME[input.contentType]
  if (mimeAllowedForStorage(input.contentType, defaultMime)) {
    return defaultMime
  }

  return null
}

export function buildMediaDownloadFilename(input: {
  storagePath: string
  content: string
  mimeType: string | null
}): string {
  const trimmedContent = input.content.trim()
  if (trimmedContent.length > 0 && trimmedContent.includes('.')) {
    return trimmedContent.replace(/[\\/:*?"<>|]/g, '_')
  }

  const extension = input.storagePath.includes('.')
    ? (input.storagePath.split('.').pop()?.toLowerCase() ?? 'bin')
    : 'bin'

  if (input.mimeType === 'application/pdf' || extension === 'pdf') {
    return `document.${extension}`
  }

  return `attachment.${extension}`
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

export function buildOutboundMediaStoragePath(input: {
  organizationId: string
  conversationId: string
  uploadId: string
  extension: string
}): string {
  return `${input.organizationId}/${input.conversationId}/${input.uploadId}.${input.extension}`
}

export function isStoragePathForConversation(input: {
  organizationId: string
  conversationId: string
  storagePath: string
}): boolean {
  const expectedPrefix = `${input.organizationId}/${input.conversationId}/`
  return input.storagePath.startsWith(expectedPrefix) && !input.storagePath.includes('..')
}

export type OutboundMediaContentType = InboundMediaContentType
