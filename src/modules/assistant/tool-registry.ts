import type { AuthContext } from '../../shared/auth/index.js'
import type { IntegrationPlatform } from '../integrations/integrations.constants.js'
import type { AssistantToolDefinition } from './openai.client.js'
import {
  getConversationStats,
  getConversationStatsToolDefinition,
  listConversationsForAssistant,
  listConversationsToolDefinition,
  type ListConversationsToolInput,
} from './tools/conversations.tools.js'
import {
  listGmailMessagesForAssistant,
  listGmailMessagesToolDefinition,
  type ListGmailMessagesToolInput,
} from './tools/gmail.tools.js'
import {
  getIntegrationStatusSnapshot,
  getIntegrationStatusToolDefinition,
} from './tools/integrations.tools.js'

type AssistantTool = {
  definition: AssistantToolDefinition
  execute: (auth: AuthContext, args: Record<string, unknown>) => Promise<unknown>
}

const MESSAGING_PLATFORMS: IntegrationPlatform[] = ['whatsapp', 'instagram']

function hasMessagingIntegration(connected: IntegrationPlatform[]): boolean {
  return connected.some((platform) => MESSAGING_PLATFORMS.includes(platform))
}

function parseListConversationsInput(args: Record<string, unknown>): ListConversationsToolInput {
  const input: ListConversationsToolInput = {}

  if (args.filter === 'needs_reply' || args.filter === 'to_nudge' || args.filter === 'all') {
    input.filter = args.filter
  }

  if (args.platform === 'whatsapp' || args.platform === 'instagram') {
    input.platform = args.platform
  }

  if (typeof args.limit === 'number' && Number.isFinite(args.limit)) {
    input.limit = args.limit
  }

  return input
}

function parseListGmailMessagesInput(args: Record<string, unknown>): ListGmailMessagesToolInput {
  const input: ListGmailMessagesToolInput = {}

  if (typeof args.limit === 'number' && Number.isFinite(args.limit)) {
    input.limit = args.limit
  }

  return input
}

export async function buildAssistantTools(auth: AuthContext): Promise<AssistantTool[]> {
  const status = await getIntegrationStatusSnapshot(auth.organizationId)
  const tools: AssistantTool[] = [
    {
      definition: getIntegrationStatusToolDefinition,
      execute: async () => status,
    },
  ]

  if (hasMessagingIntegration(status.connected)) {
    tools.push(
      {
        definition: getConversationStatsToolDefinition,
        execute: async (toolAuth) => getConversationStats(toolAuth),
      },
      {
        definition: listConversationsToolDefinition,
        execute: async (toolAuth, args) =>
          listConversationsForAssistant(toolAuth, parseListConversationsInput(args)),
      },
    )
  }

  if (status.connected.includes('gmail')) {
    tools.push({
      definition: listGmailMessagesToolDefinition,
      execute: async (toolAuth, args) =>
        listGmailMessagesForAssistant(toolAuth, parseListGmailMessagesInput(args)),
    })
  }

  return tools
}

export async function buildAssistantToolDefinitions(
  auth: AuthContext,
): Promise<AssistantToolDefinition[]> {
  const tools = await buildAssistantTools(auth)
  return tools.map((tool) => tool.definition)
}

export async function executeAssistantTool(
  auth: AuthContext,
  tools: AssistantTool[],
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = tools.find((candidate) => candidate.definition.function.name === name)
  if (tool === undefined) {
    return { error: `Unknown tool: ${name}` }
  }

  return tool.execute(auth, args)
}
