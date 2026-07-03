import { loadEnv } from '../../../shared/config/index.js'
import { logger } from '../../../shared/logger.js'
import { getRedisClient } from '../../../shared/redis/client.js'
import { enqueueCatalogueIndexJob } from '../../../shared/queue/catalogue.queue.js'
import type { BusinessProfileRecord } from '../business.repository.js'
import * as catalogueRepository from './catalogue.repository.js'
import {
  formatCatalogueContextLines,
  selectRelevantCatalogueChunks,
} from './catalogue.retrieve.js'

const BACKFILL_DEDUP_TTL_SECONDS = 60 * 60

async function maybeEnqueueMissingCatalogueIndexJobs(
  organizationId: string,
  profile: BusinessProfileRecord,
): Promise<void> {
  const env = loadEnv()
  if (!env.BUSINESS_CATALOGUE_INDEX_ENABLED || profile.catalogue_files.length === 0) {
    return
  }

  const chunkCount = await catalogueRepository.countChunksForOrganization(organizationId)
  if (chunkCount > 0) {
    return
  }

  const dedupKey = `catalogue-backfill:${organizationId}:${profile.updated_at}`
  const acquired = await getRedisClient().set(
    dedupKey,
    '1',
    'EX',
    BACKFILL_DEDUP_TTL_SECONDS,
    'NX',
  )
  if (acquired === null) {
    return
  }

  for (const file of profile.catalogue_files) {
    await enqueueCatalogueIndexJob({
      organizationId,
      fileId: file.id,
      storagePath: file.storagePath,
      filename: file.filename,
      mimeType: file.mimeType,
    })
  }

  logger.info(`[catalogue] Scheduled backfill indexing for ${profile.catalogue_files.length} file(s)`)
}

export async function buildCatalogueContextLines(
  organizationId: string,
  profile: BusinessProfileRecord,
  customerMessage?: string,
): Promise<string[]> {
  const env = loadEnv()
  if (!env.BUSINESS_CATALOGUE_INDEX_ENABLED || profile.catalogue_files.length === 0) {
    return []
  }

  await maybeEnqueueMissingCatalogueIndexJobs(organizationId, profile)

  const chunks = await catalogueRepository.listChunksForOrganization(organizationId)
  if (chunks.length === 0) {
    return []
  }

  const query =
    customerMessage !== undefined && customerMessage.trim().length > 0
      ? customerMessage.trim()
      : profile.business_description ?? profile.brand_name ?? ''

  const selected = selectRelevantCatalogueChunks({
    chunks,
    customerMessage: query,
  })

  return formatCatalogueContextLines(selected)
}
