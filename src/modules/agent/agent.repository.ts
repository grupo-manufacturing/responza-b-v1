import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'

export type AgentSettingsRecord = {
  organization_id: string
  enabled: boolean
  confidence_threshold: number
  business_hours_enabled: boolean
  business_hours_timezone: string
  business_hours_start: string
  business_hours_end: string
  created_at: string
  updated_at: string
}

export type AgentDecisionAction = 'skip' | 'draft' | 'send'

export type AgentSettingsUpdatePatch = {
  enabled?: boolean
  confidence_threshold?: number
  business_hours_enabled?: boolean
  business_hours_timezone?: string
  business_hours_start?: string
  business_hours_end?: string
}

const AGENT_SETTINGS_COLUMNS =
  'organization_id, enabled, confidence_threshold, business_hours_enabled, business_hours_timezone, business_hours_start, business_hours_end, created_at, updated_at'

function normalizeAgentSettings(row: Record<string, unknown>): AgentSettingsRecord {
  return {
    organization_id: row.organization_id as string,
    enabled: row.enabled as boolean,
    confidence_threshold: Number(row.confidence_threshold),
    business_hours_enabled: row.business_hours_enabled as boolean,
    business_hours_timezone: row.business_hours_timezone as string,
    business_hours_start: row.business_hours_start as string,
    business_hours_end: row.business_hours_end as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function getAgentSettings(organizationId: string): Promise<AgentSettingsRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('agent_settings')
    .select(AGENT_SETTINGS_COLUMNS)
    .eq('organization_id', organizationId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load agent settings')
  }

  if (data !== null) {
    return normalizeAgentSettings(data as Record<string, unknown>)
  }

  const now = new Date().toISOString()
  const { data: created, error: createError } = await client
    .from('agent_settings')
    .insert({
      organization_id: organizationId,
      enabled: false,
      confidence_threshold: 0.9,
      business_hours_enabled: false,
      business_hours_timezone: 'Asia/Kolkata',
      business_hours_start: '09:00',
      business_hours_end: '18:00',
      created_at: now,
      updated_at: now,
    })
    .select(AGENT_SETTINGS_COLUMNS)
    .single()

  if (createError !== null || created === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to initialize agent settings')
  }

  return normalizeAgentSettings(created as Record<string, unknown>)
}

export async function updateAgentSettings(
  organizationId: string,
  patch: AgentSettingsUpdatePatch,
): Promise<AgentSettingsRecord> {
  await getAgentSettings(organizationId)

  const client = getSupabaseAdminClient()
  const updatedAt = new Date().toISOString()
  const { data, error } = await client
    .from('agent_settings')
    .update({
      ...patch,
      updated_at: updatedAt,
    })
    .eq('organization_id', organizationId)
    .select(AGENT_SETTINGS_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update agent settings')
  }

  return normalizeAgentSettings(data as Record<string, unknown>)
}

export async function insertAgentDecision(input: {
  organizationId: string
  conversationId: string
  messageId: string
  action: AgentDecisionAction
  reason?: string | null
  confidence?: number | null
  draftReply?: string | null
  sourcesUsed?: string[] | null
  gateResult?: Record<string, unknown> | null
  sentMessageId?: string | null
}): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client.from('agent_decisions').insert({
    organization_id: input.organizationId,
    conversation_id: input.conversationId,
    message_id: input.messageId,
    action: input.action,
    reason: input.reason ?? null,
    confidence: input.confidence ?? null,
    draft_reply: input.draftReply ?? null,
    sources_used: input.sourcesUsed ?? null,
    gate_result: input.gateResult ?? null,
    sent_message_id: input.sentMessageId ?? null,
  })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to record agent decision')
  }
}
