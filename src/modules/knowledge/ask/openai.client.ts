import { loadEnv } from '../../../shared/config/index.js'
import { AppError } from '../../../shared/errors/index.js'

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

export async function completeKnowledgeChat(input: {
  system: string
  user: string
}): Promise<string> {
  const env = loadEnv()

  if (!env.AI_ENABLED) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'OpenAI is not enabled.')
  }

  const apiKey = env.OPENAI_API_KEY.trim()
  if (apiKey.length === 0) {
    throw new AppError(503, 'SERVICE_UNAVAILABLE', 'OpenAI is not configured.')
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
        model: env.KNOWLEDGE_CHAT_MODEL,
        temperature: 0,
        messages: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
      signal: controller.signal,
    })

    const payload = (await response.json()) as ChatCompletionResponse

    if (!response.ok) {
      throw new AppError(
        503,
        'SERVICE_UNAVAILABLE',
        payload.error?.message ?? 'OpenAI chat request failed.',
      )
    }

    return payload.choices?.[0]?.message?.content?.trim() ?? ''
  } finally {
    clearTimeout(timeout)
  }
}
