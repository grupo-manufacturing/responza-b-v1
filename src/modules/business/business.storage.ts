import { randomUUID } from 'node:crypto'

import {
  extensionForMediaMimeType,
  inferMimeTypeFromFilename,
  normalizeMimeType,
  sniffMimeTypeFromBuffer,
} from '../media/media.constants.js'
import { uploadMessageMedia } from '../../shared/storage/supabase.storage.js'
import { AppError } from '../../shared/errors/index.js'
import {
  CATALOGUE_ALLOWED_MIME_TYPES,
  CATALOGUE_MAX_FILE_SIZE_BYTES,
} from './business.constants.js'

function buildCatalogueStoragePath(input: {
  organizationId: string
  fileId: string
  extension: string
}): string {
  return `${input.organizationId}/business-catalogue/${input.fileId}.${input.extension}`
}

function isAllowedCatalogueMimeType(mimeType: string): boolean {
  return (CATALOGUE_ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)
}

export async function storeBusinessCatalogueFile(input: {
  organizationId: string
  buffer: Buffer
  mimeTypeHint: string
  filename?: string | null
}): Promise<{
  id: string
  storagePath: string
  mimeType: string
  fileSizeBytes: number
  filename: string
}> {
  if (input.buffer.byteLength === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Catalogue file is required')
  }

  if (input.buffer.byteLength > CATALOGUE_MAX_FILE_SIZE_BYTES) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Catalogue file exceeds the 10 MB limit')
  }

  const sniffed = sniffMimeTypeFromBuffer(input.buffer)
  const candidates = [
    sniffed !== null ? normalizeMimeType(sniffed) : '',
    normalizeMimeType(input.mimeTypeHint),
    inferMimeTypeFromFilename(input.filename) ?? '',
  ].filter((mime) => mime.length > 0)

  const resolvedMimeType = candidates.find((mime) => isAllowedCatalogueMimeType(mime)) ?? null

  if (resolvedMimeType === null) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Unsupported catalogue file type')
  }

  const fileId = randomUUID()
  const storagePath = buildCatalogueStoragePath({
    organizationId: input.organizationId,
    fileId,
    extension: extensionForMediaMimeType('document', resolvedMimeType),
  })

  await uploadMessageMedia({
    storagePath,
    body: input.buffer,
    mimeType: resolvedMimeType,
  })

  const filename =
    input.filename !== null && input.filename !== undefined && input.filename.trim().length > 0
      ? input.filename.trim()
      : `catalogue.${extensionForMediaMimeType('document', resolvedMimeType)}`

  return {
    id: fileId,
    storagePath,
    mimeType: resolvedMimeType,
    fileSizeBytes: input.buffer.byteLength,
    filename,
  }
}
