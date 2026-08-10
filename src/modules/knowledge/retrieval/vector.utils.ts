export function parseEmbedding(value: unknown): number[] | null {
  if (Array.isArray(value)) {
    return value.every((item) => typeof item === 'number') ? (value as number[]) : null
  }

  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'number')) {
      return parsed as number[]
    }
  } catch {
    // Fall through to pgvector literal format: [1,2,3]
  }

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim()
    if (inner.length === 0) {
      return []
    }

    const values = inner.split(',').map((part) => Number(part.trim()))
    if (values.every((item) => Number.isFinite(item))) {
      return values
    }
  }

  return null
}

/** Cosine distance — matches pgvector `<=>` for typical embedding vectors. */
export function cosineDistance(left: number[], right: number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return 1
  }

  let dot = 0
  let normLeft = 0
  let normRight = 0

  for (let index = 0; index < left.length; index += 1) {
    const a = left[index] ?? 0
    const b = right[index] ?? 0
    dot += a * b
    normLeft += a * a
    normRight += b * b
  }

  if (normLeft === 0 || normRight === 0) {
    return 1
  }

  return 1 - dot / (Math.sqrt(normLeft) * Math.sqrt(normRight))
}
