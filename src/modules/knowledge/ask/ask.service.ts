import { askAgent } from './agent-graph.js'
import { getChunkSimilarity, retrieveRelevantChunks } from '../retrieval/retrieval.service.js'
import type { RetrievedChunk } from '../retrieval/retrieval.service.js'

export type AskSourceReference = {
  id: string
  source_type: string
  source_ref: string | null
  similarity: number
  content_preview: string
}

export type AgentResponse = {
  answer: string
  is_fallback: boolean
  sources: RetrievedChunk[]
}

export async function askBusinessAgent(
  organizationId: string,
  question: string,
  options?: { conversationContext?: string },
): Promise<AgentResponse> {
  const chunks = await retrieveRelevantChunks(organizationId, question)
  const result = await askAgent(question, chunks, {
    conversationContext: options?.conversationContext,
  })

  return {
    answer: result.answer,
    is_fallback: result.is_fallback,
    sources: result.is_fallback ? [] : chunks,
  }
}

export function toAskSourceReferences(
  sources: RetrievedChunk[],
  previewLength: number,
): AskSourceReference[] {
  return sources.map((source) => ({
    id: source.id,
    source_type: source.source_type,
    source_ref: source.source_ref,
    similarity: Number(getChunkSimilarity(source.distance).toFixed(4)),
    content_preview: source.content.slice(0, previewLength),
  }))
}
