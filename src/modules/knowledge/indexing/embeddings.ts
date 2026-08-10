import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'

const EMBEDDING_BATCH_SIZE = 100

type EmbeddingResponse = {
  data?: Array<{
    embedding?: number[]
  }>
  error?: {
    message?: string
  }
}

export function isKnowledgeEmbeddingsConfigured(): boolean {
  const env = loadEnv()
  return env.AI_ENABLED && env.OPENAI_API_KEY.trim().length > 0
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return []
  }

  if (!isKnowledgeEmbeddingsConfigured()) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'OpenAI is not configured for knowledge embeddings.')
  }

  const env = loadEnv()
  const apiKey = env.OPENAI_API_KEY.trim()
  const embeddings: number[][] = []

  for (let index = 0; index < texts.length; index += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(index, index + EMBEDDING_BATCH_SIZE)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: env.KNOWLEDGE_EMBEDDING_MODEL,
          input: batch,
          dimensions: env.KNOWLEDGE_EMBEDDING_DIMENSIONS,
        }),
        signal: controller.signal,
      })

      const payload = (await response.json()) as EmbeddingResponse

      if (!response.ok) {
        throw new AppError(
          503,
          'SERVICE_UNAVAILABLE',
          payload.error?.message ?? 'OpenAI embeddings request failed.',
        )
      }

      const batchEmbeddings = (payload.data ?? []).map((item) => item.embedding ?? [])
      if (batchEmbeddings.length !== batch.length) {
        throw new AppError(503, 'SERVICE_UNAVAILABLE', 'OpenAI returned an incomplete embeddings batch.')
      }

      embeddings.push(...batchEmbeddings)
    } finally {
      clearTimeout(timeout)
    }
  }

  return embeddings
}
