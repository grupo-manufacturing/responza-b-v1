import type { RewriteBody } from './ai.schemas.js'
import { buildRewriteSystemPrompt } from './prompts/rewrite.prompt.js'
import { completeChat } from './providers/openai.client.js'

export async function rewriteDraft(input: RewriteBody) {
  const rewritten = await completeChat({
    system: buildRewriteSystemPrompt(),
    user: input.draft,
  })

  return { rewritten }
}
