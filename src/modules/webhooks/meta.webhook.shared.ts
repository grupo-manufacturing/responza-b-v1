import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'

export type WebhookVerifyQuery = {
  mode?: string
  token?: string
  challenge?: string
}

export function verifyMetaWebhookChallenge(query: WebhookVerifyQuery): string {
  const { WEBHOOK_VERIFY_TOKEN } = loadEnv()

  if (WEBHOOK_VERIFY_TOKEN.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'WEBHOOK_VERIFY_TOKEN is not configured')
  }

  const mode = query.mode
  const token = query.token
  const challenge = query.challenge

  if (mode !== 'subscribe' || token !== WEBHOOK_VERIFY_TOKEN || challenge === undefined) {
    throw new AppError(403, 'FORBIDDEN', 'Webhook verification failed')
  }

  return challenge
}

export function resolveMetaWebhookAppSecret(): string {
  const { META_APP_SECRET } = loadEnv()
  return META_APP_SECRET.trim()
}

export function resolveInstagramWebhookAppSecret(): string {
  const { INSTAGRAM_APP_SECRET, META_APP_SECRET } = loadEnv()
  const instagramSecret = INSTAGRAM_APP_SECRET.trim()
  if (instagramSecret.length > 0) {
    return instagramSecret
  }

  return META_APP_SECRET.trim()
}
