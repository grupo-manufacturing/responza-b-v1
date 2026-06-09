export const LEAD_STATUS_VALUES = [
  'new',
  'contacted',
  'qualified',
  'proposal_sent',
  'won',
  'lost',
] as const

export type LeadStatus = (typeof LEAD_STATUS_VALUES)[number]

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
