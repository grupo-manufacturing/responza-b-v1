import {
  CATALOGUE_CHUNK_OVERLAP_CHARS,
  CATALOGUE_CHUNK_SIZE_CHARS,
  CATALOGUE_MAX_EXTRACTED_CHARS_PER_FILE,
} from './catalogue.constants.js'

function hardSplitText(text: string, chunkSize: number, overlap: number): string[] {
  const parts: string[] = []

  for (let index = 0; index < text.length; index += Math.max(1, chunkSize - overlap)) {
    parts.push(text.slice(index, index + chunkSize))
    if (index + chunkSize >= text.length) {
      break
    }
  }

  return parts
}

export function chunkCatalogueText(
  text: string,
  options?: {
    chunkSize?: number
    overlap?: number
    maxTotalChars?: number
  },
): string[] {
  const chunkSize = options?.chunkSize ?? CATALOGUE_CHUNK_SIZE_CHARS
  const overlap = options?.overlap ?? CATALOGUE_CHUNK_OVERLAP_CHARS
  const maxTotalChars = options?.maxTotalChars ?? CATALOGUE_MAX_EXTRACTED_CHARS_PER_FILE

  const normalized = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim()
  if (normalized.length === 0) {
    return []
  }

  const truncated = normalized.slice(0, maxTotalChars)
  const paragraphs = truncated
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)

  const chunks: string[] = []
  let current = ''

  for (const paragraph of paragraphs) {
    if (paragraph.length > chunkSize) {
      if (current.length > 0) {
        chunks.push(current)
        current = ''
      }

      chunks.push(...hardSplitText(paragraph, chunkSize, overlap))
      continue
    }

    const next = current.length === 0 ? paragraph : `${current}\n\n${paragraph}`
    if (next.length <= chunkSize) {
      current = next
      continue
    }

    chunks.push(current)
    current = paragraph
  }

  if (current.length > 0) {
    chunks.push(current)
  }

  return chunks
}
