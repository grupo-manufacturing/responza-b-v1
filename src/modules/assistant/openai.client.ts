import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'

export type AssistantToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type AssistantChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: AssistantToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string }

export type AssistantToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      role?: string
      content?: string | null
      tool_calls?: AssistantToolCall[]
    }
  }>
  error?: {
    message?: string
  }
}

export type AssistantCompletionMessage = {
  role: 'assistant'
  content: string | null
  tool_calls?: AssistantToolCall[]
}

export async function completeAssistantChat(input: {
  messages: AssistantChatMessage[]
  tools: AssistantToolDefinition[]
}): Promise<AssistantCompletionMessage> {
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
        model: env.OPENAI_MODEL,
        temperature: 0,
        messages: input.messages,
        tools: input.tools,
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

    const message = payload.choices?.[0]?.message
    if (message === undefined) {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'OpenAI returned an empty response.')
    }

    return {
      role: 'assistant',
      content: message.content ?? null,
      tool_calls: message.tool_calls,
    }
  } finally {
    clearTimeout(timeout)
  }
}
