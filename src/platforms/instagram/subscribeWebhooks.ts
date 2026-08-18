import { parseGraphApiError } from '../shared/graphErrors.js'
import { AppError } from '../../shared/errors/index.js'
import { instagramGraphApiBaseUrl } from './graphApi.js'

const INSTAGRAM_WEBHOOK_FIELDS = ['messages', 'messaging_seen'] as const

type SubscribeAppsResponse = {
  success?: boolean
}

export async function subscribeInstagramWebhooks(input: {
  businessAccountId: string
  accessToken: string
}): Promise<void> {
  const businessAccountId = input.businessAccountId.trim()
  const accessToken = input.accessToken.trim()

  if (businessAccountId.length === 0 || accessToken.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Instagram account ID and access token are required')
  }

  const url = new URL(`${instagramGraphApiBaseUrl()}/${businessAccountId}/subscribed_apps`)
  url.searchParams.set('subscribed_fields', INSTAGRAM_WEBHOOK_FIELDS.join(','))
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url, { method: 'POST' })

  if (!response.ok) {
    const message = await parseGraphApiError(response, 'Instagram webhook subscription failed')
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const data = (await response.json()) as SubscribeAppsResponse
  if (data.success !== true) {
    throw new AppError(502, 'BAD_REQUEST', 'Instagram webhook subscription was not confirmed')
  }
}
