import { getSupabaseAdminClient } from '../../shared/database/index.js'
import { AppError } from '../../shared/errors/index.js'

export async function recordWebhookEventIfNew(input: {
  eventId: string
  eventType: string
  payload: unknown
}): Promise<boolean> {
  const client = getSupabaseAdminClient()
  const { error } = await client.from('razorpay_webhook_events').insert({
    event_id: input.eventId,
    event_type: input.eventType,
    payload: input.payload,
  })

  if (error === null) {
    return true
  }

  if (error.code === '23505') {
    return false
  }

  throw new AppError(500, 'INTERNAL_ERROR', 'Failed to record Razorpay webhook event')
}
