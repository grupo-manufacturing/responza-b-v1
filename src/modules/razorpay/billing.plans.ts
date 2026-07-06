import type { Env } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'

export const BILLING_PLAN_KEYS = ['basic', 'premium', 'scale', 'enterprise'] as const

export type BillingPlanKey = (typeof BILLING_PLAN_KEYS)[number]

export type RazorpayKeyMode = 'test' | 'live' | 'unknown'

export type BillingPlanCatalogEntry = {
  readonly key: BillingPlanKey
  readonly label: string
  readonly conversationLimit: number
  /** GST-inclusive amount in paise (e.g. ₹499 → 49900). */
  readonly amountPaise: number
  readonly currency: 'INR'
  readonly interval: 'monthly'
}

export type BillingPlan = BillingPlanCatalogEntry & {
  readonly razorpayPlanId: string
}

/** Public API shape — Razorpay plan IDs stay server-side. */
export type BillingPlanPublic = BillingPlanCatalogEntry & {
  readonly amountInr: number
}

const BILLING_PLAN_CATALOG: Record<BillingPlanKey, BillingPlanCatalogEntry> = {
  basic: {
    key: 'basic',
    label: 'Basic',
    conversationLimit: 1_000,
    amountPaise: 49_900,
    currency: 'INR',
    interval: 'monthly',
  },
  premium: {
    key: 'premium',
    label: 'Premium',
    conversationLimit: 2_500,
    amountPaise: 500_000,
    currency: 'INR',
    interval: 'monthly',
  },
  scale: {
    key: 'scale',
    label: 'Scale',
    conversationLimit: 7_000,
    amountPaise: 1_000_000,
    currency: 'INR',
    interval: 'monthly',
  },
  enterprise: {
    key: 'enterprise',
    label: 'Enterprise',
    conversationLimit: 25_000,
    amountPaise: 2_000_000,
    currency: 'INR',
    interval: 'monthly',
  },
}

const RAZORPAY_PLAN_ID_BY_KEY: Record<BillingPlanKey, (env: Env) => string> = {
  basic: (env) => env.RAZORPAY_PLAN_BASIC,
  premium: (env) => env.RAZORPAY_PLAN_PREMIUM,
  scale: (env) => env.RAZORPAY_PLAN_SCALE,
  enterprise: (env) => env.RAZORPAY_PLAN_ENTERPRISE,
}

export function isBillingPlanKey(value: string): value is BillingPlanKey {
  return (BILLING_PLAN_KEYS as readonly string[]).includes(value)
}

export function isRazorpayConfigured(env: Env): boolean {
  return env.RAZORPAY_KEY_ID.length > 0 && env.RAZORPAY_KEY_SECRET.length > 0
}

export function resolveRazorpayKeyMode(keyId: string): RazorpayKeyMode {
  const normalized = keyId.trim()
  if (normalized.startsWith('rzp_test_')) {
    return 'test'
  }
  if (normalized.startsWith('rzp_live_')) {
    return 'live'
  }
  return 'unknown'
}

export function getRazorpayKeyMode(env: Env): RazorpayKeyMode {
  if (!isRazorpayConfigured(env)) {
    return 'unknown'
  }

  return resolveRazorpayKeyMode(env.RAZORPAY_KEY_ID)
}

export function isRazorpayBillingConfigured(env: Env): boolean {
  if (!isRazorpayConfigured(env)) {
    return false
  }

  return BILLING_PLAN_KEYS.every((key) => resolveRazorpayPlanId(env, key).length > 0)
}

function resolveRazorpayPlanId(env: Env, key: BillingPlanKey): string {
  return RAZORPAY_PLAN_ID_BY_KEY[key](env).trim()
}

export function resolveBillingPlan(env: Env, key: BillingPlanKey): BillingPlan {
  const catalog = BILLING_PLAN_CATALOG[key]
  const razorpayPlanId = resolveRazorpayPlanId(env, key)

  if (razorpayPlanId.length === 0) {
    throw new AppError(
      503,
      'BILLING_NOT_CONFIGURED',
      `Razorpay plan is not configured for the ${catalog.label} plan.`,
    )
  }

  return {
    ...catalog,
    razorpayPlanId,
  }
}

export function listBillingPlans(env: Env): BillingPlan[] {
  return BILLING_PLAN_KEYS.map((key) => resolveBillingPlan(env, key))
}

export function listBillingPlansPublic(): BillingPlanPublic[] {
  return BILLING_PLAN_KEYS.map((key) => toBillingPlanPublic(BILLING_PLAN_CATALOG[key]))
}

function toBillingPlanPublic(plan: BillingPlanCatalogEntry): BillingPlanPublic {
  return {
    ...plan,
    amountInr: plan.amountPaise / 100,
  }
}

export function getBillingPlanCatalogEntry(key: BillingPlanKey): BillingPlanCatalogEntry {
  return BILLING_PLAN_CATALOG[key]
}

export function resolveBillingPlanKeyByRazorpayPlanId(
  env: Env,
  razorpayPlanId: string,
): BillingPlanKey | null {
  const normalized = razorpayPlanId.trim()
  if (normalized.length === 0) {
    return null
  }

  for (const key of BILLING_PLAN_KEYS) {
    if (resolveRazorpayPlanId(env, key) === normalized) {
      return key
    }
  }

  return null
}
