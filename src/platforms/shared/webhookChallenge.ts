import { AppError } from '../../shared/errors/index.js'

export type WebhookVerifyQuery = {
  mode?: string
  token?: string
  challenge?: string
}

export function verifyMetaWebhookChallenge(
  query: WebhookVerifyQuery,
  verifyToken: string,
): string {
  if (verifyToken.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'WEBHOOK_VERIFY_TOKEN is not configured')
  }

  const mode = query.mode
  const token = query.token
  const challenge = query.challenge

  if (mode !== 'subscribe' || token !== verifyToken || challenge === undefined) {
    throw new AppError(403, 'FORBIDDEN', 'Webhook verification failed')
  }

  return challenge
}
