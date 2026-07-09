import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import { logger } from '../../shared/logger.js'
import { isRazorpayConfigured } from './billing.plans.js'
import type {
  CancelRazorpaySubscriptionInput,
  CreateRazorpayCustomerInput,
  CreateRazorpaySubscriptionInput,
  RazorpayApiErrorBody,
  RazorpayCustomer,
  RazorpaySubscription,
} from './razorpay.types.js'

const RAZORPAY_API_BASE_URL = 'https://api.razorpay.com/v1'

function getAuthHeader(): string {
  const env = loadEnv()
  const credentials = `${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}

function assertRazorpayConfigured(): void {
  if (!isRazorpayConfigured(loadEnv())) {
    throw new AppError(503, 'BILLING_NOT_CONFIGURED', 'Razorpay is not configured.')
  }
}

function toUnixSeconds(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

function sanitizeCustomerName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length >= 3) {
    return trimmed.slice(0, 50)
  }

  return 'Responza AI Customer'
}

function mapRazorpayError(status: number, body: RazorpayApiErrorBody): AppError {
  const description = body.error?.description ?? 'Razorpay request failed.'
  const code = body.error?.code

  logger.warn('[razorpay] API request failed', {
    status,
    code,
    description,
  })

  if (status === 400) {
    return new AppError(400, 'BAD_REQUEST', description, { razorpayCode: code })
  }

  if (status === 401 || status === 403) {
    return new AppError(503, 'BILLING_NOT_CONFIGURED', 'Razorpay authentication failed.')
  }

  if (status === 404) {
    return new AppError(404, 'NOT_FOUND', description, { razorpayCode: code })
  }

  return new AppError(502, 'INTERNAL_ERROR', 'Payment provider request failed. Please try again.', {
    razorpayCode: code,
  })
}

async function razorpayRequest<T>(
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  assertRazorpayConfigured()
  const env = loadEnv()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.RAZORPAY_REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${RAZORPAY_API_BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })

    const data = (await response.json()) as T & RazorpayApiErrorBody

    if (!response.ok) {
      throw mapRazorpayError(response.status, data)
    }

    return data
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error
    }

    if (error instanceof Error && error.name === 'AbortError') {
      throw new AppError(504, 'INTERNAL_ERROR', 'Payment provider request timed out. Please try again.')
    }

    logger.warn('[razorpay] API request error', {
      error: error instanceof Error ? error.message : String(error),
    })
    throw new AppError(502, 'INTERNAL_ERROR', 'Payment provider request failed. Please try again.')
  } finally {
    clearTimeout(timeout)
  }
}

export function getRazorpayKeyId(): string {
  assertRazorpayConfigured()
  return loadEnv().RAZORPAY_KEY_ID
}

export async function createCustomer(input: CreateRazorpayCustomerInput): Promise<RazorpayCustomer> {
  return razorpayRequest<RazorpayCustomer>('POST', '/customers', {
    name: sanitizeCustomerName(input.name),
    email: input.email,
    fail_existing: '0',
    notes: {
      organization_id: input.organizationId,
    },
  })
}

export async function fetchCustomer(customerId: string): Promise<RazorpayCustomer> {
  return razorpayRequest<RazorpayCustomer>('GET', `/customers/${customerId}`)
}

export async function createSubscription(
  input: CreateRazorpaySubscriptionInput,
): Promise<RazorpaySubscription> {
  const env = loadEnv()
  const payload: Record<string, unknown> = {
    plan_id: input.planId,
    customer_id: input.customerId,
    total_count: env.RAZORPAY_SUBSCRIPTION_TOTAL_COUNT,
    quantity: 1,
    customer_notify: true,
    notes: {
      organization_id: input.organizationId,
      plan_key: input.planKey,
    },
  }

  if (input.startAt !== undefined) {
    payload.start_at = toUnixSeconds(input.startAt)
  }

  return razorpayRequest<RazorpaySubscription>('POST', '/subscriptions', payload)
}

export async function fetchSubscription(subscriptionId: string): Promise<RazorpaySubscription> {
  return razorpayRequest<RazorpaySubscription>('GET', `/subscriptions/${subscriptionId}`)
}

export async function cancelSubscription(
  input: CancelRazorpaySubscriptionInput,
): Promise<RazorpaySubscription> {
  const cancelAtCycleEnd = input.cancelAtCycleEnd ?? true

  return razorpayRequest<RazorpaySubscription>('POST', `/subscriptions/${input.subscriptionId}/cancel`, {
    cancel_at_cycle_end: cancelAtCycleEnd,
  })
}
