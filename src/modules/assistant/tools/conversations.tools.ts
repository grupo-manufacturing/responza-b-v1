import type { AuthContext } from '../../../shared/auth/index.js'
import * as dashboardService from '../../dashboard/dashboard.service.js'
import * as inboxRepository from '../../inbox/inbox.repository.js'
import type { IntegrationPlatform } from '../../integrations/integrations.constants.js'
import {
  ASSISTANT_LIST_CONVERSATIONS_DEFAULT_LIMIT,
  ASSISTANT_LIST_CONVERSATIONS_MAX_LIMIT,
} from '../assistant.constants.js'

export type ConversationListFilter = 'needs_reply' | 'to_nudge' | 'all'

export type ListConversationsToolInput = {
  filter?: ConversationListFilter
  platform?: IntegrationPlatform
  limit?: number
}

function toToolConversationItem(conversation: dashboardService.DashboardConversationItem) {
  return {
    id: conversation.id,
    platform: conversation.platform,
    displayName: conversation.displayName,
    lastMessage: conversation.lastMessage,
    lastMessageAt: conversation.lastMessageAt,
    inboxPath:
      conversation.platform === 'instagram'
        ? `/instagram?conversation=${conversation.id}`
        : `/whatsapp?conversation=${conversation.id}`,
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return ASSISTANT_LIST_CONVERSATIONS_DEFAULT_LIMIT
  }

  return Math.min(Math.max(1, limit), ASSISTANT_LIST_CONVERSATIONS_MAX_LIMIT)
}

export async function getConversationStats(auth: AuthContext) {
  const dashboard = await dashboardService.getDashboard(auth)

  return {
    totalConversations: dashboard.stats.totalConversations,
    conversationsByPlatform: dashboard.stats.conversationsByPlatform,
    avgResponseTimeSeconds: dashboard.stats.avgResponseTimeSeconds,
    needsReplyCount: dashboard.needsReply.length,
    toNudgeCount: dashboard.toNudge.length,
  }
}

export async function listConversationsForAssistant(
  auth: AuthContext,
  input: ListConversationsToolInput,
) {
  const filter = input.filter ?? 'all'
  const limit = clampLimit(input.limit)
  const dashboard = await dashboardService.getDashboard(auth)

  if (filter === 'needs_reply') {
    const items = dashboard.needsReply
      .filter((conversation) =>
        input.platform === undefined ? true : conversation.platform === input.platform,
      )
      .slice(0, limit)
      .map(toToolConversationItem)

    return { filter, platform: input.platform ?? null, count: items.length, conversations: items }
  }

  if (filter === 'to_nudge') {
    const items = dashboard.toNudge
      .filter((conversation) =>
        input.platform === undefined ? true : conversation.platform === input.platform,
      )
      .slice(0, limit)
      .map(toToolConversationItem)

    return { filter, platform: input.platform ?? null, count: items.length, conversations: items }
  }

  const result = await inboxRepository.listConversations({
    organizationId: auth.organizationId,
    platform: input.platform,
    limit,
  })

  const conversations = result.conversations.map((conversation) => ({
    id: conversation.id,
    platform: conversation.platform,
    displayName: conversation.contact_display_name ?? conversation.external_id,
    lastMessage: conversation.last_message_content,
    lastMessageAt: conversation.last_message_at,
    inboxPath:
      conversation.platform === 'instagram'
        ? `/instagram?conversation=${conversation.id}`
        : `/whatsapp?conversation=${conversation.id}`,
  }))

  return {
    filter,
    platform: input.platform ?? null,
    count: conversations.length,
    conversations,
  }
}

export const getConversationStatsToolDefinition = {
  type: 'function' as const,
  function: {
    name: 'get_conversation_stats',
    description:
      'Returns conversation totals, per-platform counts (WhatsApp/Instagram), average response time, and counts of threads needing reply or nudge.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
}

export const listConversationsToolDefinition = {
  type: 'function' as const,
  function: {
    name: 'list_conversations',
    description:
      'Lists conversations from WhatsApp and Instagram. Filter by needs_reply (customer waiting), to_nudge (you replied but customer went quiet), or all.',
    parameters: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['needs_reply', 'to_nudge', 'all'],
          description: 'Which conversations to return. Defaults to all.',
        },
        platform: {
          type: 'string',
          enum: ['whatsapp', 'instagram'],
          description: 'Optional platform filter.',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: ASSISTANT_LIST_CONVERSATIONS_MAX_LIMIT,
          description: 'Max conversations to return.',
        },
      },
      additionalProperties: false,
    },
  },
}
