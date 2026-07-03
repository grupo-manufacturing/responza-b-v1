import { loadEnv } from '../../../shared/config/index.js'
import { downloadMessageMedia } from '../../../shared/storage/index.js'
import { logger } from '../../../shared/logger.js'
import * as businessRepository from '../business.repository.js'
import { chunkCatalogueText } from './catalogue.chunk.js'
import { extractCatalogueText } from './catalogue.extract.js'
import * as catalogueRepository from './catalogue.repository.js'
import type { CatalogueIndexJobData } from '../../../shared/queue/catalogue.queue.js'

export async function processCatalogueIndexJob(data: CatalogueIndexJobData): Promise<void> {
  const env = loadEnv()
  if (!env.BUSINESS_CATALOGUE_INDEX_ENABLED) {
    return
  }

  const profile = await businessRepository.findProfileByOrganizationId(data.organizationId)
  if (profile === null) {
    logger.warn('[catalogue] Index skipped: business profile not found', {
      organizationId: data.organizationId,
      fileId: data.fileId,
    })
    return
  }

  const fileStillExists = profile.catalogue_files.some((file) => file.id === data.fileId)
  if (!fileStillExists) {
    await catalogueRepository.deleteChunksForFile(data.organizationId, data.fileId)
    return
  }

  const buffer = await downloadMessageMedia(data.storagePath)
  const extractedText = await extractCatalogueText({
    buffer,
    mimeType: data.mimeType,
    filename: data.filename,
  })

  if (extractedText === null || extractedText.trim().length === 0) {
    await catalogueRepository.deleteChunksForFile(data.organizationId, data.fileId)
    logger.warn('[catalogue] No extractable text for catalogue file', {
      organizationId: data.organizationId,
      fileId: data.fileId,
      filename: data.filename,
    })
    return
  }

  const existingChunks = await catalogueRepository.listChunksForOrganization(data.organizationId)
  const otherFileChunkCount = existingChunks.filter((chunk) => chunk.file_id !== data.fileId).length
  const remainingChunkBudget = Math.max(
    0,
    env.BUSINESS_CATALOGUE_MAX_CHUNKS_PER_ORG - otherFileChunkCount,
  )

  const chunks = chunkCatalogueText(extractedText, {
    chunkSize: env.BUSINESS_CATALOGUE_CHUNK_SIZE_CHARS,
    overlap: env.BUSINESS_CATALOGUE_CHUNK_OVERLAP_CHARS,
    maxTotalChars: env.BUSINESS_CATALOGUE_EXTRACT_MAX_CHARS_PER_FILE,
  }).slice(0, remainingChunkBudget)

  if (chunks.length === 0) {
    await catalogueRepository.deleteChunksForFile(data.organizationId, data.fileId)
    logger.warn('[catalogue] Chunk budget exhausted for organization', {
      organizationId: data.organizationId,
      fileId: data.fileId,
    })
    return
  }

  await catalogueRepository.replaceChunksForFile({
    organization_id: data.organizationId,
    file_id: data.fileId,
    filename: data.filename,
    chunks,
  })

  logger.info(
    `[catalogue] Indexed ${chunks.length} chunk(s) for file ${data.fileId} (${data.filename})`,
  )
}

export async function processCatalogueDeleteJob(data: {
  organizationId: string
  fileId: string
}): Promise<void> {
  await catalogueRepository.deleteChunksForFile(data.organizationId, data.fileId)
}
