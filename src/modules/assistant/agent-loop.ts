import type { AuthContext } from '../../shared/auth/index.js'
import { ASSISTANT_FALLBACK_MESSAGE, ASSISTANT_MAX_TOOL_ROUNDS } from './assistant.constants.js'
import {
  buildAssistantTools,
  executeAssistantTool,
} from './tool-registry.js'
import {
  completeAssistantChat,
  type AssistantChatMessage,
  type AssistantToolCall,
} from './openai.client.js'
import { ASSISTANT_SYSTEM_PROMPT } from './prompts.js'

function parseToolArguments(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
  } catch {
    // fall through
  }

  return {}
}

async function runToolCalls(
  auth: AuthContext,
  tools: Awaited<ReturnType<typeof buildAssistantTools>>,
  toolCalls: AssistantToolCall[],
): Promise<AssistantChatMessage[]> {
  const results: AssistantChatMessage[] = []

  for (const toolCall of toolCalls) {
    const args = parseToolArguments(toolCall.function.arguments)
    const output = await executeAssistantTool(auth, tools, toolCall.function.name, args)

    results.push({
      role: 'tool',
      tool_call_id: toolCall.id,
      content: JSON.stringify(output),
    })
  }

  return results
}

export async function runAssistantAgent(
  auth: AuthContext,
  question: string,
): Promise<{ answer: string }> {
  const tools = await buildAssistantTools(auth)
  const messages: AssistantChatMessage[] = [
    { role: 'system', content: ASSISTANT_SYSTEM_PROMPT },
    { role: 'user', content: question },
  ]

  for (let round = 0; round < ASSISTANT_MAX_TOOL_ROUNDS; round += 1) {
    const completion = await completeAssistantChat({
      messages,
      tools: tools.map((tool) => tool.definition),
    })

    const toolCalls = completion.tool_calls ?? []
    if (toolCalls.length === 0) {
      const answer = completion.content?.trim()
      return { answer: answer && answer.length > 0 ? answer : ASSISTANT_FALLBACK_MESSAGE }
    }

    messages.push({
      role: 'assistant',
      content: completion.content,
      tool_calls: toolCalls,
    })

    const toolResults = await runToolCalls(auth, tools, toolCalls)
    messages.push(...toolResults)
  }

  return { answer: ASSISTANT_FALLBACK_MESSAGE }
}
