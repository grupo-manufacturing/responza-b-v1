import { evaluateInboundMessage } from './agent.service.js'
import type { AgentEvaluateJobData } from '../../shared/queue/agent.queue.js'

export async function processAgentEvaluateJob(data: AgentEvaluateJobData): Promise<void> {
  await evaluateInboundMessage(data)
}
