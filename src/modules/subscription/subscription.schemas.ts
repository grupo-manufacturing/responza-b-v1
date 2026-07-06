import { z } from 'zod'

import { BILLING_PLAN_KEYS } from '../razorpay/billing.plans.js'

export const checkoutBodySchema = z.object({
  plan: z.enum(BILLING_PLAN_KEYS),
})

export const cancelSubscriptionBodySchema = z.object({
  cancelAtCycleEnd: z.boolean().optional().default(true),
})

export type CheckoutBody = z.infer<typeof checkoutBodySchema>
export type CancelSubscriptionBody = z.infer<typeof cancelSubscriptionBodySchema>
