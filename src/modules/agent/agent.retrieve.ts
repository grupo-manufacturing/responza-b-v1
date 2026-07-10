import { loadEnv } from '../../shared/config/index.js'
import { createEmbedding } from '../ai/providers/openai.client.js'
import { buildBusinessContextLines } from '../business/business.context.js'
import { findProfileByOrganizationId } from '../business/business.repository.js'
import * as knowledgeRepository from '../knowledge/knowledge.repository.js'

export type RetrievedKnowledgeContext = {
  coreContext: string[]
  chunks: Array<{
    sourceLabel: string
    content: string
    similarity: number
  }>
}

function toSourceLabel(
  sourceType: string,
  sourceKey: string,
  metadata: Record<string, unknown>,
): string {
  if (typeof metadata.label === 'string' && metadata.label.length > 0) {
    return metadata.label
  }

  if (sourceType === 'catalogue' && typeof metadata.filename === 'string') {
    return `catalogue:${metadata.filename}`
  }

  if (sourceType === 'website' && typeof metadata.url === 'string') {
    return `website:${metadata.url}`
  }

  if (sourceType === 'instagram' && typeof metadata.label === 'string') {
    return metadata.label
  }

  return `${sourceType}:${sourceKey}`
}

export async function retrieveAgentContext(input: {
  organizationId: string
  inboundMessage: string
}): Promise<RetrievedKnowledgeContext> {
  const env = loadEnv()
  const profile = await findProfileByOrganizationId(input.organizationId)
  const coreContext = buildBusinessContextLines(profile)
  const embedding = await createEmbedding(input.inboundMessage)
  const matches = await knowledgeRepository.matchKnowledgeChunks({
    organizationId: input.organizationId,
    embedding,
    topK: env.AGENT_RETRIEVAL_TOP_K,
  })

  return {
    coreContext,
    chunks: matches.map((match) => ({
      sourceLabel: toSourceLabel(match.source_type, match.source_key, match.metadata),
      content: match.content,
      similarity: match.similarity,
    })),
  }
}

export function formatRetrievedContext(context: RetrievedKnowledgeContext): string {
  const sections: string[] = []

  if (context.coreContext.length > 0) {
    sections.push('Business profile:')
    sections.push(...context.coreContext)
  }

  if (context.chunks.length > 0) {
    sections.push('')
    sections.push('Relevant knowledge snippets:')
    for (const chunk of context.chunks) {
      sections.push(`[${chunk.sourceLabel}] ${chunk.content}`)
    }
  }

  return sections.join('\n')
}
