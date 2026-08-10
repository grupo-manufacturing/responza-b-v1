import { loadEnv } from '../../../shared/config/index.js'
import { cleanText } from '../ingestion/text-cleaner.js'

export type TextChunk = {
  content: string
  source_type: string
  source_ref: string | null
}

export function chunkText(text: string): string[] {
  const env = loadEnv()
  const chunkSize = env.KNOWLEDGE_CHUNK_SIZE
  const overlap = env.KNOWLEDGE_CHUNK_OVERLAP

  let normalized = cleanText(text)
  if (normalized.length === 0) {
    return []
  }

  if (normalized.length <= chunkSize) {
    return [normalized]
  }

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    let end = Math.min(start + chunkSize, normalized.length)
    let chunk = normalized.slice(start, end)

    if (end < normalized.length) {
      const breakAt = Math.max(chunk.lastIndexOf('\n\n'), chunk.lastIndexOf('. '), chunk.lastIndexOf(' '))
      if (breakAt > chunkSize / 2) {
        end = start + breakAt + 1
        chunk = normalized.slice(start, end)
      }
    }

    const trimmed = chunk.trim()
    if (trimmed.length > 0) {
      chunks.push(trimmed)
    }

    if (end >= normalized.length) {
      break
    }

    start = Math.max(end - overlap, start + 1)
  }

  return chunks
}

export function chunkSourceContent(
  content: string,
  sourceType: string,
  sourceRef: string | null,
): TextChunk[] {
  return chunkText(content).map((chunk) => ({
    content: chunk,
    source_type: sourceType,
    source_ref: sourceRef,
  }))
}
