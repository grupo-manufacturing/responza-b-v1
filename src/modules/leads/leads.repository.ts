import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { decodeCursor, encodeCursor, type CursorPayload } from '../../shared/pagination/cursor.js'
import { AppError } from '../../shared/errors/index.js'
import type { LeadSource, LeadStatus } from './leads.constants.js'

export type LeadRecord = {
  id: string
  organization_id: string
  conversation_id: string | null
  assigned_to: string | null
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  source: LeadSource
  status: LeadStatus
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type LeadInsertInput = {
  organization_id: string
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  source: LeadSource
  status: LeadStatus
  metadata?: Record<string, unknown>
}

export type LeadUpdatePatch = {
  name?: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  status?: LeadStatus
  metadata?: Record<string, unknown>
}

const LEAD_COLUMNS =
  'id, organization_id, conversation_id, assigned_to, name, email, phone, notes, source, status, metadata, created_at, updated_at'

export async function insertLead(input: LeadInsertInput): Promise<LeadRecord> {
  const client = getSupabaseAdminClient()
  const now = new Date().toISOString()

  const { data, error } = await client
    .from('leads')
    .insert({
      organization_id: input.organization_id,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      notes: input.notes ?? null,
      source: input.source,
      status: input.status,
      metadata: input.metadata ?? {},
      updated_at: now,
    })
    .select(LEAD_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create lead')
  }

  return normalizeLeadRecord(data)
}

export async function findLeadById(
  organizationId: string,
  leadId: string,
): Promise<LeadRecord | null> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('leads')
    .select(LEAD_COLUMNS)
    .eq('organization_id', organizationId)
    .eq('id', leadId)
    .maybeSingle()

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load lead')
  }

  if (data === null) {
    return null
  }

  return normalizeLeadRecord(data)
}

export async function deleteLead(organizationId: string, leadId: string): Promise<void> {
  const client = getSupabaseAdminClient()
  const { error } = await client
    .from('leads')
    .delete()
    .eq('organization_id', organizationId)
    .eq('id', leadId)

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to delete lead')
  }
}

export async function updateLead(
  organizationId: string,
  leadId: string,
  patch: LeadUpdatePatch,
): Promise<LeadRecord> {
  const client = getSupabaseAdminClient()
  const { data, error } = await client
    .from('leads')
    .update({
      ...patch,
      updated_at: new Date().toISOString(),
    })
    .eq('organization_id', organizationId)
    .eq('id', leadId)
    .select(LEAD_COLUMNS)
    .single()

  if (error !== null || data === null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to update lead')
  }

  return normalizeLeadRecord(data)
}

export type ListLeadsInput = {
  organizationId: string
  limit: number
  cursor?: string
  status?: LeadStatus
}

export type ListLeadsResult = {
  leads: LeadRecord[]
  nextCursor: string | null
}

export async function listLeads(input: ListLeadsInput): Promise<ListLeadsResult> {
  const client = getSupabaseAdminClient()
  const fetchLimit = input.limit + 1

  let query = client
    .from('leads')
    .select(LEAD_COLUMNS)
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(fetchLimit)

  if (input.status !== undefined) {
    query = query.eq('status', input.status)
  }

  if (input.cursor !== undefined) {
    const decoded = decodeCursor(input.cursor)
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    )
  }

  const { data, error } = await query

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list leads')
  }

  const rows = (data ?? []).map(normalizeLeadRecord)
  const hasMore = rows.length > input.limit
  const leads = hasMore ? rows.slice(0, input.limit) : rows

  let nextCursor: string | null = null
  if (hasMore) {
    const last = leads[leads.length - 1]
    if (last !== undefined) {
      nextCursor = encodeCursor({
        createdAt: last.created_at,
        id: last.id,
      } satisfies CursorPayload)
    }
  }

  return { leads, nextCursor }
}

function normalizeLeadRecord(row: Record<string, unknown>): LeadRecord {
  const metadata = row.metadata
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    conversation_id: (row.conversation_id as string | null) ?? null,
    assigned_to: (row.assigned_to as string | null) ?? null,
    name: row.name as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    source: row.source as LeadSource,
    status: row.status as LeadStatus,
    metadata:
      metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}
