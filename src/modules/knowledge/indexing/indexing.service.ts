import type { DocumentChunkInsert, IngestedSourceRecord } from '../jobs/knowledge-job.types.js'
import { chunkSourceContent } from './chunking.js'
import type { TextChunk } from './chunking.js'
import { embedTexts } from './embeddings.js'

export type IndexingResult = {
  chunks_created: number
  sources_processed: number
  chunks_by_source: Record<string, number>
}

export type BuildKnowledgeBaseResult = {
  documentChunks: DocumentChunkInsert[]
  indexingResult: IndexingResult
}

export async function buildKnowledgeBase(
  ingestedSources: IngestedSourceRecord[],
): Promise<BuildKnowledgeBaseResult> {
  if (ingestedSources.length === 0) {
    throw new Error('No ingested content found. Run ingestion first.')
  }

  const textChunks: TextChunk[] = []
  const indexingResult: IndexingResult = {
    chunks_created: 0,
    sources_processed: 0,
    chunks_by_source: {},
  }

  for (const source of ingestedSources) {
    const sourceChunks = chunkSourceContent(source.content, source.source_type, source.source_ref)
    textChunks.push(...sourceChunks)
    indexingResult.chunks_by_source[source.source_type] =
      (indexingResult.chunks_by_source[source.source_type] ?? 0) + sourceChunks.length
    indexingResult.sources_processed += 1
  }

  if (textChunks.length === 0) {
    throw new Error('No chunks generated from ingested content.')
  }

  const embeddings = await embedTexts(textChunks.map((chunk) => chunk.content))

  const documentChunks: DocumentChunkInsert[] = textChunks.map((textChunk, index) => ({
    source_type: textChunk.source_type,
    source_ref: textChunk.source_ref,
    content: textChunk.content,
    embedding: embeddings[index] ?? null,
  }))

  indexingResult.chunks_created = documentChunks.length

  return {
    documentChunks,
    indexingResult,
  }
}
