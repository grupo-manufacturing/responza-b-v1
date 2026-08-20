import type { AuthContext } from '../../shared/auth/index.js'
import { runAssistantAgent } from './agent-loop.js'
import type { AssistantAskBody } from './assistant.schemas.js'

export async function askAssistant(auth: AuthContext, body: AssistantAskBody) {
  const result = await runAssistantAgent(auth, body.question)
  return result
}
