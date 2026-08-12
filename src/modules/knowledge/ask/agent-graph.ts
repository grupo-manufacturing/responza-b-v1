import { FALLBACK_MESSAGE, SYSTEM_PROMPT, buildUserPrompt, formatContext } from './prompts.js'
import { completeKnowledgeChat } from './openai.client.js'
import type { RetrievedChunk } from '../retrieval/retrieval.service.js'

export type AgentAnswer = {
  answer: string
  is_fallback: boolean
}

export async function askAgent(
  question: string,
  chunks: RetrievedChunk[],
  options?: { conversationContext?: string },
): Promise<AgentAnswer> {
  if (chunks.length === 0) {
    return {
      answer: FALLBACK_MESSAGE,
      is_fallback: true,
    }
  }

  const context = formatContext(chunks)
  const answer = await completeKnowledgeChat({
    system: SYSTEM_PROMPT,
    user: buildUserPrompt(question, context, options?.conversationContext),
  })

  const normalizedAnswer = answer.length > 0 ? answer : FALLBACK_MESSAGE
  if (normalizedAnswer === FALLBACK_MESSAGE) {
    return {
      answer: FALLBACK_MESSAGE,
      is_fallback: true,
    }
  }

  return {
    answer: normalizedAnswer,
    is_fallback: false,
  }
}
