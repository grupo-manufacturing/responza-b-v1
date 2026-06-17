import type { AuthContext } from '../../shared/auth/index.js'
import { findProfileByOrganizationId } from '../business/business.repository.js'
import type { RewriteBody } from './ai.schemas.js'
import { buildRewriteSystemPrompt } from './prompts/rewrite.prompt.js'
import { completeChat } from './providers/openai.client.js'

export async function rewriteDraft(auth: AuthContext, input: RewriteBody) {
  const profile = await findProfileByOrganizationId(auth.organizationId)
  const system = buildRewriteSystemPrompt(profile)
  const rewritten = await completeChat({
    system,
    user: input.draft,
  })

  return { rewritten }
}
