import type { AuthContext } from '../../shared/auth/index.js'
import { integrationPlatformToApi } from '../integrations/integrations.constants.js'
import * as inboxRepository from '../inbox/inbox.repository.js'
import type { ConversationListRecord } from '../inbox/inbox.repository.js'
import {
  DASHBOARD_NUDGE_AFTER_DAYS,
  DASHBOARD_QUEUE_LIMIT,
  DASHBOARD_RESPONSE_TIME_WINDOW_DAYS,
} from './dashboard.constants.js'
import * as dashboardRepository from './dashboard.repository.js'

export type DashboardConversationItem = {
  id: string
  organizationId: string
  channelId: string
  platform: string
  channelDisplayName: string
  externalId: string
  displayName: string
  avatarUrl: string | null
  lastMessage: string | null
  lastMessageAt: string
  createdAt: string
}

export type DashboardStats = {
  totalConversations: number
  conversationsByPlatform: {
    whatsapp: number
    instagram: number
  }
  avgResponseTimeSeconds: number | null
}

export type DashboardResponse = {
  stats: DashboardStats
  needsReply: DashboardConversationItem[]
  toNudge: DashboardConversationItem[]
}

function toConversationItem(conversation: ConversationListRecord): DashboardConversationItem {
  return {
    id: conversation.id,
    organizationId: conversation.organization_id,
    channelId: conversation.channel_id,
    platform: integrationPlatformToApi(conversation.platform),
    channelDisplayName: conversation.channel_display_name,
    externalId: conversation.external_id,
    displayName: conversation.contact_display_name ?? conversation.external_id,
    avatarUrl: conversation.contact_avatar_url,
    lastMessage: conversation.last_message_content,
    lastMessageAt: conversation.last_message_at,
    createdAt: conversation.created_at,
  }
}

function subtractDays(from: Date, days: number): Date {
  const result = new Date(from)
  result.setDate(result.getDate() - days)
  return result
}

function buildPlatformCounts(conversations: ConversationListRecord[]): DashboardStats['conversationsByPlatform'] {
  const counts = { whatsapp: 0, instagram: 0 }

  for (const conversation of conversations) {
    if (conversation.platform === 'whatsapp') {
      counts.whatsapp += 1
    } else if (conversation.platform === 'instagram') {
      counts.instagram += 1
    }
  }

  return counts
}

function computeAverageResponseTimeSeconds(
  messages: dashboardRepository.ResponseTimeMessageRow[],
  windowStartIso: string,
): number | null {
  const windowStartMs = new Date(windowStartIso).getTime()
  const messagesByConversation = new Map<string, dashboardRepository.ResponseTimeMessageRow[]>()

  for (const message of messages) {
    const existing = messagesByConversation.get(message.conversation_id)
    if (existing === undefined) {
      messagesByConversation.set(message.conversation_id, [message])
    } else {
      existing.push(message)
    }
  }

  const responseTimesSeconds: number[] = []

  for (const conversationMessages of messagesByConversation.values()) {
    for (let index = 0; index < conversationMessages.length; index += 1) {
      const inbound = conversationMessages[index]
      if (inbound.direction !== 'inbound') {
        continue
      }

      if (new Date(inbound.created_at).getTime() < windowStartMs) {
        continue
      }

      const outbound = conversationMessages
        .slice(index + 1)
        .find((message) => message.direction === 'outbound')

      if (outbound === undefined) {
        continue
      }

      const deltaMs =
        new Date(outbound.created_at).getTime() - new Date(inbound.created_at).getTime()

      if (deltaMs >= 0) {
        responseTimesSeconds.push(deltaMs / 1000)
      }
    }
  }

  if (responseTimesSeconds.length === 0) {
    return null
  }

  const totalSeconds = responseTimesSeconds.reduce((sum, value) => sum + value, 0)
  return Math.round(totalSeconds / responseTimesSeconds.length)
}

function buildConversationQueues(
  conversations: ConversationListRecord[],
  latestMessages: Map<string, dashboardRepository.MessageDirectionSnapshot>,
): { needsReply: DashboardConversationItem[]; toNudge: DashboardConversationItem[] } {
  const nudgeCutoffMs = subtractDays(new Date(), DASHBOARD_NUDGE_AFTER_DAYS).getTime()
  const needsReply: ConversationListRecord[] = []
  const toNudge: ConversationListRecord[] = []

  for (const conversation of conversations) {
    const latestMessage = latestMessages.get(conversation.id)
    if (latestMessage === undefined) {
      continue
    }

    if (latestMessage.direction === 'inbound') {
      needsReply.push({
        ...conversation,
        last_message_content: latestMessage.content,
        last_message_at: latestMessage.created_at,
      })
      continue
    }

    if (
      latestMessage.direction === 'outbound' &&
      new Date(latestMessage.created_at).getTime() <= nudgeCutoffMs
    ) {
      toNudge.push({
        ...conversation,
        last_message_content: latestMessage.content,
        last_message_at: latestMessage.created_at,
      })
    }
  }

  needsReply.sort(
    (left, right) =>
      new Date(right.last_message_at).getTime() - new Date(left.last_message_at).getTime(),
  )

  toNudge.sort(
    (left, right) =>
      new Date(left.last_message_at).getTime() - new Date(right.last_message_at).getTime(),
  )

  return {
    needsReply: needsReply.slice(0, DASHBOARD_QUEUE_LIMIT).map(toConversationItem),
    toNudge: toNudge.slice(0, DASHBOARD_QUEUE_LIMIT).map(toConversationItem),
  }
}

export async function getDashboard(auth: AuthContext): Promise<DashboardResponse> {
  const responseWindowStart = subtractDays(new Date(), DASHBOARD_RESPONSE_TIME_WINDOW_DAYS)

  const [conversationResult, responseTimeMessages] = await Promise.all([
    inboxRepository.listConversations({ organizationId: auth.organizationId }),
    dashboardRepository.fetchMessagesForResponseTime(
      auth.organizationId,
      responseWindowStart.toISOString(),
    ),
  ])

  const conversations = conversationResult.conversations

  const conversationIds = conversations.map((conversation) => conversation.id)
  const latestMessages = await dashboardRepository.fetchLatestMessageSnapshots(
    auth.organizationId,
    conversationIds,
  )

  const { needsReply, toNudge } = buildConversationQueues(conversations, latestMessages)

  return {
    stats: {
      totalConversations: conversations.length,
      conversationsByPlatform: buildPlatformCounts(conversations),
      avgResponseTimeSeconds: computeAverageResponseTimeSeconds(
        responseTimeMessages,
        responseWindowStart.toISOString(),
      ),
    },
    needsReply,
    toNudge,
  }
}
