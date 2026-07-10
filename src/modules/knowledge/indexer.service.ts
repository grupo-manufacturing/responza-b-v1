import { getInstagramCredentialsForOrganization } from '../integrations/credentials.service.js'
import { buildBusinessContextLines } from '../business/business.context.js'
import { findProfileByOrganizationId } from '../business/business.repository.js'
import type { CatalogueFileRecord } from '../business/business.types.js'
import { createEmbedding } from '../ai/providers/openai.client.js'
import { downloadMessageMedia } from '../../shared/storage/supabase.storage.js'
import { logger } from '../../shared/logger.js'
import { crawlWebsite } from './crawlers/website.crawler.js'
import { extractTextFromBuffer } from './extractors/document.extractor.js'
import { chunkText } from './knowledge.chunk.js'
import {
  KNOWLEDGE_CHUNK_OVERLAP,
  KNOWLEDGE_CHUNK_SIZE,
  PROFILE_CORE_SOURCE_KEY,
  type KnowledgeIndexScope,
  type KnowledgeSourceType,
} from './knowledge.constants.js'
import * as knowledgeRepository from './knowledge.repository.js'
import { syncInstagramKnowledge } from './syncers/instagram.syncer.js'

async function indexTextSource(input: {
  organizationId: string
  sourceType: KnowledgeSourceType
  sourceKey: string
  text: string
  metadata: Record<string, unknown>
}): Promise<number> {
  await knowledgeRepository.deleteChunksForSource({
    organizationId: input.organizationId,
    sourceType: input.sourceType,
    sourceKey: input.sourceKey,
  })

  const chunks = chunkText(input.text, KNOWLEDGE_CHUNK_SIZE, KNOWLEDGE_CHUNK_OVERLAP)
  if (chunks.length === 0) {
    return 0
  }

  const inserts = []

  for (const [chunkIndex, content] of chunks.entries()) {
    const embedding = await createEmbedding(content)
    inserts.push({
      organization_id: input.organizationId,
      source_type: input.sourceType,
      source_key: input.sourceKey,
      chunk_index: chunkIndex,
      content,
      embedding,
      metadata: input.metadata,
    })
  }

  await knowledgeRepository.insertKnowledgeChunks(inserts)
  return inserts.length
}

async function indexProfileCore(organizationId: string): Promise<number> {
  const profile = await findProfileByOrganizationId(organizationId)
  if (profile === null) {
    return 0
  }

  const lines = buildBusinessContextLines(profile)
  if (lines.length === 0) {
    await knowledgeRepository.deleteChunksForSource({
      organizationId,
      sourceType: 'profile',
      sourceKey: PROFILE_CORE_SOURCE_KEY,
    })
    return 0
  }

  return indexTextSource({
    organizationId,
    sourceType: 'profile',
    sourceKey: PROFILE_CORE_SOURCE_KEY,
    text: lines.join('\n'),
    metadata: {
      label: 'Business profile',
    },
  })
}

async function indexCatalogueFile(
  organizationId: string,
  file: CatalogueFileRecord,
): Promise<number> {
  const buffer = await downloadMessageMedia(file.storagePath)
  const text = await extractTextFromBuffer({
    buffer,
    mimeType: file.mimeType,
    filename: file.filename,
  })

  if (text.trim().length === 0) {
    await knowledgeRepository.deleteChunksForSource({
      organizationId,
      sourceType: 'catalogue',
      sourceKey: file.id,
    })
    return 0
  }

  return indexTextSource({
    organizationId,
    sourceType: 'catalogue',
    sourceKey: file.id,
    text,
    metadata: {
      filename: file.filename,
      mimeType: file.mimeType,
      label: `catalogue:${file.filename}`,
    },
  })
}

async function indexAllCatalogueFiles(organizationId: string): Promise<number> {
  const profile = await findProfileByOrganizationId(organizationId)
  const catalogueFiles = profile?.catalogue_files ?? []
  let indexedChunkCount = 0

  for (const file of catalogueFiles) {
    try {
      indexedChunkCount += await indexCatalogueFile(organizationId, file)
    } catch (error: unknown) {
      logger.warn('[knowledge] Failed to index catalogue file', {
        organizationId,
        fileId: file.id,
        filename: file.filename,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return indexedChunkCount
}

async function indexWebsite(organizationId: string): Promise<number> {
  const profile = await findProfileByOrganizationId(organizationId)
  const websiteUrl = profile?.website_url?.trim() ?? ''

  await knowledgeRepository.deleteChunksBySourceType({
    organizationId,
    sourceType: 'website',
  })

  if (websiteUrl.length === 0) {
    return 0
  }

  const pages = await crawlWebsite(websiteUrl)
  let indexedChunkCount = 0

  for (const page of pages) {
    indexedChunkCount += await indexTextSource({
      organizationId,
      sourceType: 'website',
      sourceKey: page.sourceKey,
      text: page.text,
      metadata: {
        url: page.url,
        label: `website:${page.sourceKey}`,
      },
    })
  }

  return indexedChunkCount
}

async function indexInstagram(organizationId: string): Promise<number> {
  const credentials = await getInstagramCredentialsForOrganization(organizationId)

  await knowledgeRepository.deleteChunksBySourceType({
    organizationId,
    sourceType: 'instagram',
  })

  if (credentials === null) {
    return 0
  }

  const documents = await syncInstagramKnowledge(credentials)
  let indexedChunkCount = 0

  for (const document of documents) {
    indexedChunkCount += await indexTextSource({
      organizationId,
      sourceType: 'instagram',
      sourceKey: document.sourceKey,
      text: document.text,
      metadata: document.metadata,
    })
  }

  return indexedChunkCount
}

function resolveScope(input: {
  scope?: KnowledgeIndexScope
  catalogueFileId?: string
}): KnowledgeIndexScope {
  if (input.catalogueFileId !== undefined) {
    return 'catalogue'
  }

  return input.scope ?? 'full'
}

async function finalizeIndexState(organizationId: string): Promise<number> {
  const totalChunkCount = await knowledgeRepository.countKnowledgeChunks(organizationId)
  await knowledgeRepository.upsertKnowledgeIndexState({
    organizationId,
    chunkCount: totalChunkCount,
    lastError: null,
  })
  return totalChunkCount
}

export async function indexOrganizationKnowledge(input: {
  organizationId: string
  scope?: KnowledgeIndexScope
  catalogueFileId?: string
}): Promise<void> {
  const { organizationId, catalogueFileId } = input
  const scope = resolveScope(input)

  try {
    let indexedChunkCount = 0

    if (scope === 'full') {
      indexedChunkCount += await indexProfileCore(organizationId)
      indexedChunkCount += await indexAllCatalogueFiles(organizationId)
      indexedChunkCount += await indexWebsite(organizationId)
      indexedChunkCount += await indexInstagram(organizationId)
    } else if (scope === 'profile') {
      indexedChunkCount += await indexProfileCore(organizationId)
    } else if (scope === 'catalogue') {
      if (catalogueFileId === undefined) {
        indexedChunkCount += await indexAllCatalogueFiles(organizationId)
      } else {
        const profile = await findProfileByOrganizationId(organizationId)
        const file = profile?.catalogue_files.find((item) => item.id === catalogueFileId)
        if (file !== undefined) {
          indexedChunkCount += await indexCatalogueFile(organizationId, file)
        }
      }
    } else if (scope === 'website') {
      indexedChunkCount += await indexWebsite(organizationId)
    } else if (scope === 'instagram') {
      indexedChunkCount += await indexInstagram(organizationId)
    }

    const totalChunkCount = await finalizeIndexState(organizationId)

    logger.warn(
      `[knowledge] Indexing completed org=${organizationId} scope=${scope} indexed=${indexedChunkCount} total=${totalChunkCount}`,
    )
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Knowledge indexing failed'
    await knowledgeRepository.upsertKnowledgeIndexState({
      organizationId,
      chunkCount: await knowledgeRepository.countKnowledgeChunks(organizationId),
      lastError: message,
    })
    throw error
  }
}

export async function removeCatalogueKnowledge(input: {
  organizationId: string
  catalogueFileId: string
}): Promise<void> {
  await knowledgeRepository.deleteChunksForSource({
    organizationId: input.organizationId,
    sourceType: 'catalogue',
    sourceKey: input.catalogueFileId,
  })

  const totalChunkCount = await knowledgeRepository.countKnowledgeChunks(input.organizationId)
  await knowledgeRepository.upsertKnowledgeIndexState({
    organizationId: input.organizationId,
    chunkCount: totalChunkCount,
    lastError: null,
  })
}

export async function removeInstagramKnowledge(organizationId: string): Promise<void> {
  await knowledgeRepository.deleteChunksBySourceType({
    organizationId,
    sourceType: 'instagram',
  })

  const totalChunkCount = await knowledgeRepository.countKnowledgeChunks(organizationId)
  await knowledgeRepository.upsertKnowledgeIndexState({
    organizationId,
    chunkCount: totalChunkCount,
    lastError: null,
  })
}

export async function refreshAllWebsiteKnowledge(): Promise<void> {
  const organizationIds = await knowledgeRepository.listOrganizationIdsWithWebsiteUrl()

  for (const organizationId of organizationIds) {
    try {
      await indexOrganizationKnowledge({
        organizationId,
        scope: 'website',
      })
    } catch (error: unknown) {
      logger.warn('[knowledge] Scheduled website refresh failed', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}

export async function refreshAllInstagramKnowledge(): Promise<void> {
  const organizationIds = await knowledgeRepository.listOrganizationIdsWithConnectedInstagram()

  for (const organizationId of organizationIds) {
    try {
      await indexOrganizationKnowledge({
        organizationId,
        scope: 'instagram',
      })
    } catch (error: unknown) {
      logger.warn('[knowledge] Scheduled Instagram refresh failed', {
        organizationId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
}
