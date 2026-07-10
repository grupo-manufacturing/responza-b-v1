import {
  indexOrganizationKnowledge,
  refreshAllInstagramKnowledge,
  refreshAllWebsiteKnowledge,
  removeCatalogueKnowledge,
} from './indexer.service.js'
import type {
  KnowledgeIndexJobData,
  KnowledgeRemoveCatalogueJobData,
} from '../../shared/queue/knowledge.queue.js'

export async function processKnowledgeIndexJob(data: KnowledgeIndexJobData): Promise<void> {
  await indexOrganizationKnowledge({
    organizationId: data.organizationId,
    scope: data.scope,
    catalogueFileId: data.catalogueFileId,
  })
}

export async function processKnowledgeRemoveCatalogueJob(
  data: KnowledgeRemoveCatalogueJobData,
): Promise<void> {
  await removeCatalogueKnowledge({
    organizationId: data.organizationId,
    catalogueFileId: data.catalogueFileId,
  })
}

export async function processKnowledgeRefreshWebsiteJob(): Promise<void> {
  await refreshAllWebsiteKnowledge()
}

export async function processKnowledgeRefreshInstagramJob(): Promise<void> {
  await refreshAllInstagramKnowledge()
}
