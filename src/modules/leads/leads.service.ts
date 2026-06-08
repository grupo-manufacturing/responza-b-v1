import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import {
  leadSourceFromApi,
  leadSourceToApi,
  leadStatusFromApi,
  leadStatusToApi,
} from './leads.constants.js'
import type { CreateLeadBody, ListLeadsQuery, UpdateLeadBody } from './leads.schemas.js'
import { dbStatusFromQueryStatus } from './leads.schemas.js'
import * as leadsRepository from './leads.repository.js'
import type { LeadRecord } from './leads.repository.js'

function toLeadResponse(lead: LeadRecord) {
  return {
    id: lead.id,
    organizationId: lead.organization_id,
    conversationId: lead.conversation_id,
    assignedTo: lead.assigned_to,
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    notes: lead.notes,
    source: leadSourceToApi(lead.source),
    status: leadStatusToApi(lead.status),
    metadata: lead.metadata,
    createdAt: lead.created_at,
    updatedAt: lead.updated_at,
  }
}

export async function listLeads(auth: AuthContext, query: ListLeadsQuery) {
  const result = await leadsRepository.listLeads({
    organizationId: auth.organizationId,
    limit: query.limit,
    cursor: query.cursor,
    status: query.status !== undefined ? dbStatusFromQueryStatus(query.status) : undefined,
  })

  return {
    leads: result.leads.map(toLeadResponse),
    page: {
      nextCursor: result.nextCursor,
      limit: query.limit,
    },
  }
}

export async function getLead(auth: AuthContext, leadId: string) {
  const lead = await leadsRepository.findLeadById(auth.organizationId, leadId)
  if (lead === null) {
    throw new AppError(404, 'NOT_FOUND', 'Lead not found')
  }

  return toLeadResponse(lead)
}

export async function createLead(auth: AuthContext, input: CreateLeadBody) {
  const lead = await leadsRepository.insertLead({
    organization_id: auth.organizationId,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    source: leadSourceFromApi(input.source),
    status: leadStatusFromApi(input.status),
    metadata: input.metadata ?? {},
  })

  return toLeadResponse(lead)
}

export async function deleteLead(auth: AuthContext, leadId: string): Promise<void> {
  const existing = await leadsRepository.findLeadById(auth.organizationId, leadId)
  if (existing === null) {
    throw new AppError(404, 'NOT_FOUND', 'Lead not found')
  }

  await leadsRepository.deleteLead(auth.organizationId, leadId)
}

export async function updateLead(auth: AuthContext, leadId: string, input: UpdateLeadBody) {
  const existing = await leadsRepository.findLeadById(auth.organizationId, leadId)
  if (existing === null) {
    throw new AppError(404, 'NOT_FOUND', 'Lead not found')
  }

  const patch: leadsRepository.LeadUpdatePatch = {}

  if (input.name !== undefined) {
    patch.name = input.name
  }
  if (input.email !== undefined) {
    patch.email = input.email === '' ? null : input.email
  }
  if (input.phone !== undefined) {
    patch.phone = input.phone === '' ? null : input.phone
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes === '' ? null : input.notes
  }
  if (input.status !== undefined) {
    try {
      patch.status = leadStatusFromApi(input.status)
    } catch {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid lead status')
    }
  }
  if (input.metadata !== undefined) {
    patch.metadata = input.metadata
  }

  const updated = await leadsRepository.updateLead(auth.organizationId, leadId, patch)
  return toLeadResponse(updated)
}
