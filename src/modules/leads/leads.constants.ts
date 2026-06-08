export const LEAD_STATUS_VALUES = [
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'won',
  'lost',
] as const

export const LEAD_SOURCE_VALUES = [
  'manual',
  'inbox',
  'whatsapp',
  'instagram',
  'indiamart',
  'other',
] as const

export type LeadStatus = (typeof LEAD_STATUS_VALUES)[number]
export type LeadSource = (typeof LEAD_SOURCE_VALUES)[number]

const STATUS_TO_API: Record<LeadStatus, string> = {
  new: 'new',
  contacted: 'contacted',
  qualified: 'qualified',
  proposal_sent: 'proposalSent',
  won: 'won',
  lost: 'lost',
}

const STATUS_FROM_API: Record<string, LeadStatus> = {
  new: 'new',
  contacted: 'contacted',
  qualified: 'qualified',
  proposalSent: 'proposal_sent',
  won: 'won',
  lost: 'lost',
}

const SOURCE_TO_API: Record<LeadSource, string> = {
  manual: 'manual',
  inbox: 'inbox',
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  indiamart: 'indiamart',
  other: 'other',
}

const SOURCE_FROM_API: Record<string, LeadSource> = {
  manual: 'manual',
  inbox: 'inbox',
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  indiamart: 'indiamart',
  other: 'other',
}

export function leadStatusToApi(status: LeadStatus): string {
  return STATUS_TO_API[status]
}

export function leadStatusFromApi(status: string): LeadStatus {
  const mapped = STATUS_FROM_API[status]
  if (mapped === undefined) {
    throw new Error(`Invalid lead status: ${status}`)
  }

  return mapped
}

export function leadSourceToApi(source: LeadSource): string {
  return SOURCE_TO_API[source]
}

export function leadSourceFromApi(source: string): LeadSource {
  const mapped = SOURCE_FROM_API[source]
  if (mapped === undefined) {
    throw new Error(`Invalid lead source: ${source}`)
  }

  return mapped
}
