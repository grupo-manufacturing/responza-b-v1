export const FALLBACK_MESSAGE = "I don't have the required information."

export const INGEST_ALLOWED_CATALOGUE_MIME_TYPES = new Set([
  'application/pdf',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
])

export const CATALOGUE_MIME_TO_FILE_TYPE = {
  'application/pdf': 'pdf',
  'text/csv': 'csv',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-excel': 'xlsx',
} as const satisfies Record<string, 'pdf' | 'csv' | 'xlsx'>

export type CatalogueFileType = (typeof CATALOGUE_MIME_TO_FILE_TYPE)[keyof typeof CATALOGUE_MIME_TO_FILE_TYPE]

export function resolveCatalogueFileType(mimeType: string): CatalogueFileType | null {
  return CATALOGUE_MIME_TO_FILE_TYPE[mimeType as keyof typeof CATALOGUE_MIME_TO_FILE_TYPE] ?? null
}

export const INGESTION_PREVIEW_LENGTH = 300
export const ASK_SOURCE_PREVIEW_LENGTH = 200
