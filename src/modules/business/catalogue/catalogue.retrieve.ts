import { loadEnv } from '../../../shared/config/index.js'
import {
  CATALOGUE_LEXICAL_STOP_WORDS,
} from './catalogue.constants.js'
import type { CatalogueChunkRecord } from './catalogue.repository.js'

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !CATALOGUE_LEXICAL_STOP_WORDS.has(token))
}

function scoreChunk(chunk: CatalogueChunkRecord, terms: string[]): number {
  if (terms.length === 0) {
    return 0
  }

  const haystack = `${chunk.filename}\n${chunk.text}`.toLowerCase()
  let score = 0

  for (const term of terms) {
    if (haystack.includes(term)) {
      score += 1
    }
  }

  return score
}

export function selectRelevantCatalogueChunks(input: {
  chunks: CatalogueChunkRecord[]
  customerMessage: string
  maxChunks?: number
  maxChars?: number
}): CatalogueChunkRecord[] {
  const env = loadEnv()
  const maxChunks = input.maxChunks ?? env.BUSINESS_CATALOGUE_RETRIEVAL_TOP_CHUNKS
  const maxChars = input.maxChars ?? env.BUSINESS_CATALOGUE_CONTEXT_MAX_CHARS

  if (input.chunks.length === 0) {
    return []
  }

  const terms = tokenizeQuery(input.customerMessage)
  const ranked = input.chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(chunk, terms),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (left.chunk.file_id !== right.chunk.file_id) {
        return left.chunk.file_id.localeCompare(right.chunk.file_id)
      }

      return left.chunk.chunk_index - right.chunk.chunk_index
    })

  const selected: CatalogueChunkRecord[] = []
  let usedChars = 0

  for (const item of ranked) {
    if (selected.length >= maxChunks) {
      break
    }

    if (item.score === 0 && selected.length > 0) {
      break
    }

    const header = `[${item.chunk.filename}] `
    const body = item.chunk.text.trim()
    const addition = `${header}${body}`

    if (usedChars + addition.length > maxChars) {
      const remaining = maxChars - usedChars
      if (remaining <= header.length + 20) {
        continue
      }

      selected.push({
        ...item.chunk,
        text: body.slice(0, remaining - header.length),
      })
      break
    }

    selected.push(item.chunk)
    usedChars += addition.length + 2
  }

  if (selected.length === 0 && ranked.length > 0) {
    const fallback = ranked[0]?.chunk
    if (fallback !== undefined) {
      selected.push({
        ...fallback,
        text: fallback.text.slice(0, maxChars),
      })
    }
  }

  return selected
}

export function formatCatalogueContextLines(chunks: CatalogueChunkRecord[]): string[] {
  if (chunks.length === 0) {
    return []
  }

  const lines = ['Relevant catalogue excerpts (use only when they answer the customer question):']

  for (const chunk of chunks) {
    lines.push(`[${chunk.filename}] ${chunk.text.trim()}`)
  }

  return lines
}
