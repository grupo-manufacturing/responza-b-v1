import { logger } from '../../shared/logger.js'
import {
  enqueueKnowledgeIndexJob,
  enqueueKnowledgeRemoveCatalogueJob,
} from '../../shared/queue/knowledge.queue.js'
import type { KnowledgeIndexScope } from './knowledge.constants.js'

export async function enqueueKnowledgeIndexForOrganization(
  organizationId: string,
  options?: {
    scope?: KnowledgeIndexScope
    catalogueFileId?: string
  },
): Promise<void> {
  try {
    await enqueueKnowledgeIndexJob({
      organizationId,
      scope: options?.scope,
      catalogueFileId: options?.catalogueFileId,
    })
  } catch (error: unknown) {
    logger.warn('[knowledge] Failed to enqueue knowledge index job', {
      organizationId,
      scope: options?.scope,
      catalogueFileId: options?.catalogueFileId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function enqueueKnowledgeRemoveCatalogue(
  organizationId: string,
  catalogueFileId: string,
): Promise<void> {
  try {
    await enqueueKnowledgeRemoveCatalogueJob({
      organizationId,
      catalogueFileId,
    })
  } catch (error: unknown) {
    logger.warn('[knowledge] Failed to enqueue catalogue removal job', {
      organizationId,
      catalogueFileId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

export async function enqueueKnowledgeWebsiteIndex(organizationId: string): Promise<void> {
  await enqueueKnowledgeIndexForOrganization(organizationId, { scope: 'website' })
}

export async function enqueueKnowledgeInstagramIndex(organizationId: string): Promise<void> {
  await enqueueKnowledgeIndexForOrganization(organizationId, { scope: 'instagram' })
}
