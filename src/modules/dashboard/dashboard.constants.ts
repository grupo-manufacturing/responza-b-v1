import type { LeadStatus } from '../leads/leads.constants.js'

/** Outbound last-message older than this → show in "conversations to nudge". */
export const DASHBOARD_NUDGE_AFTER_DAYS = 3

/** Inbound messages within this window are used for avg response time. */
export const DASHBOARD_RESPONSE_TIME_WINDOW_DAYS = 30

/** Max items returned per action queue. */
export const DASHBOARD_QUEUE_LIMIT = 8

export const DASHBOARD_FOLLOW_UP_LEAD_STATUSES: readonly LeadStatus[] = [
  'new',
  'contacted',
  'qualified',
] as const
