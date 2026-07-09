export type RazorpayCustomer = {
  readonly id: string
  readonly entity: 'customer'
  readonly name: string
  readonly email: string
  readonly contact: string | null
  readonly created_at: number
}

export type RazorpaySubscriptionStatus =
  | 'created'
  | 'authenticated'
  | 'active'
  | 'pending'
  | 'halted'
  | 'cancelled'
  | 'completed'
  | 'expired'

export type RazorpaySubscription = {
  readonly id: string
  readonly entity: 'subscription'
  readonly plan_id: string
  readonly customer_id: string | null
  readonly status: RazorpaySubscriptionStatus
  readonly current_start: number | null
  readonly current_end: number | null
  readonly ended_at: number | null
  readonly charge_at: number | null
  readonly start_at: number | null
  readonly end_at: number | null
  readonly total_count: number
  readonly paid_count: number
  readonly remaining_count: number
  readonly short_url: string | null
  readonly notes: Record<string, string> | null
  readonly created_at: number
}

export type RazorpayApiErrorBody = {
  readonly error?: {
    readonly code?: string
    readonly description?: string
    readonly field?: string
    readonly source?: string
    readonly step?: string
    readonly reason?: string
  }
}

export type CreateRazorpayCustomerInput = {
  readonly name: string
  readonly email: string
  readonly organizationId: string
}

export type CreateRazorpaySubscriptionInput = {
  readonly planId: string
  readonly customerId: string
  readonly organizationId: string
  readonly planKey: string
  readonly totalCount: number
  readonly startAt?: Date
}

export type CancelRazorpaySubscriptionInput = {
  readonly subscriptionId: string
  readonly cancelAtCycleEnd?: boolean
}
