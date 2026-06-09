import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { LeadStatus } from './leads.constants.js'

export type LeadRecord = {
  id: string
  organization_id: string
  name: string
  email: string | null
  phone: string | null
  notes: string | null
  status: LeadStatus
  created_at: string
  updated_at: string
}

export type LeadInsertInput = {
  organization_id: string
  name: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  status: LeadStatus
}

export type LeadUpdatePatch = {
  name?: string
  email?: string | null
  phone?: string | null
  notes?: string | null
  status?: LeadStatus
}

const LEAD_COLUMNS =
  'id, organization_id, name, email, phone, notes, status, created_at, updated_at'

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
      status: input.status,
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
  status?: LeadStatus
}

export async function listLeads(input: ListLeadsInput): Promise<LeadRecord[]> {
  const client = getSupabaseAdminClient()

  let query = client
    .from('leads')
    .select(LEAD_COLUMNS)
    .eq('organization_id', input.organizationId)
    .order('created_at', { ascending: false })

  if (input.status !== undefined) {
    query = query.eq('status', input.status)
  }

  const { data, error } = await query

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to list leads')
  }

  return (data ?? []).map(normalizeLeadRecord)
}

function normalizeLeadRecord(row: Record<string, unknown>): LeadRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    name: row.name as string,
    email: (row.email as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: row.status as LeadStatus,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}
