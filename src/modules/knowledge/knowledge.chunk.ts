export function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (normalized.length === 0) {
    return []
  }

  if (normalized.length <= chunkSize) {
    return [normalized]
  }

  const chunks: string[] = []
  let start = 0

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length)
    const slice = normalized.slice(start, end).trim()
    if (slice.length > 0) {
      chunks.push(slice)
    }

    if (end >= normalized.length) {
      break
    }

    start = Math.max(end - overlap, start + 1)
  }

  return chunks
}
