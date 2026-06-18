import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'
import { logger } from '../../../shared/logger.js'

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  error?: {
    message?: string
  }
}

export function isOpenAiConfigured(): boolean {
  const { AI_ENABLED, OPENAI_API_KEY } = loadEnv()
  return AI_ENABLED && OPENAI_API_KEY.trim().length > 0
}

export async function completeChat(input: {
  system: string
  user: string
}): Promise<string> {
  const env = loadEnv()

  if (!env.AI_ENABLED) {
    throw new AppError(503, 'INTERNAL_ERROR', 'AI rewrite is not enabled')
  }

  const apiKey = env.OPENAI_API_KEY.trim()
  if (apiKey.length === 0) {
    throw new AppError(503, 'INTERNAL_ERROR', 'AI rewrite is not configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
        temperature: 0.4,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    })

    const data = (await response.json()) as ChatCompletionResponse

    if (!response.ok) {
      logger.warn('[ai] OpenAI request failed', {
        status: response.status,
        message: data.error?.message ?? 'Unknown error',
      })
      throw new AppError(502, 'INTERNAL_ERROR', 'AI rewrite failed. Please try again.')
    }

    const content = data.choices?.[0]?.message?.content?.trim()
    if (content === undefined || content.length === 0) {
      throw new AppError(502, 'INTERNAL_ERROR', 'AI rewrite returned an empty response')
    }

    return content
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'INTERNAL_ERROR', 'AI rewrite timed out. Please try again.')
    }

    logger.warn('[ai] OpenAI request error', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new AppError(502, 'INTERNAL_ERROR', 'AI rewrite failed. Please try again.')
  } finally {
    clearTimeout(timeout)
  }
}

export async function completeChatJson(input: {
  system: string
  user: string
}): Promise<string> {
  const env = loadEnv()

  if (!env.AI_ENABLED) {
    throw new AppError(503, 'INTERNAL_ERROR', 'AI is not enabled')
  }

  const apiKey = env.OPENAI_API_KEY.trim()
  if (apiKey.length === 0) {
    throw new AppError(503, 'INTERNAL_ERROR', 'AI is not configured')
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.AI_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: env.OPENAI_MODEL,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
        temperature: 0.6,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })

    const data = (await response.json()) as ChatCompletionResponse

    if (!response.ok) {
      logger.warn('[ai] OpenAI JSON request failed', {
        status: response.status,
        message: data.error?.message ?? 'Unknown error',
      })
      throw new AppError(502, 'INTERNAL_ERROR', 'AI request failed. Please try again.')
    }

    const content = data.choices?.[0]?.message?.content?.trim()
    if (content === undefined || content.length === 0) {
      throw new AppError(502, 'INTERNAL_ERROR', 'AI returned an empty response')
    }

    return content
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'INTERNAL_ERROR', 'AI request timed out. Please try again.')
    }

    logger.warn('[ai] OpenAI JSON request error', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new AppError(502, 'INTERNAL_ERROR', 'AI request failed. Please try again.')
  } finally {
    clearTimeout(timeout)
  }
}
