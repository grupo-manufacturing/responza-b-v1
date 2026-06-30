export const CATALOGUE_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const CATALOGUE_MAX_FILES = 5

export const CATALOGUE_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
] as const

export type CatalogueMimeType = (typeof CATALOGUE_ALLOWED_MIME_TYPES)[number]
