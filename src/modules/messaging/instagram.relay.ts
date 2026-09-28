import { loadEnv } from '../../shared/config/index.js'
import { logger } from '../../shared/logger.js'

const RELAY_TIMEOUT_MS = 5000

export function relayInstagramWebhook(input: {
  rawBody: Buffer
  signatureHeader: string | undefined
}): void {
  const { MOBILE_INSTAGRAM_WEBHOOK_URL } = loadEnv()
  if (MOBILE_INSTAGRAM_WEBHOOK_URL.length === 0 || input.signatureHeader === undefined) {
    return
  }

  fetch(MOBILE_INSTAGRAM_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Hub-Signature': input.signatureHeader,
    },
    body: input.rawBody,
    signal: AbortSignal.timeout(RELAY_TIMEOUT_MS),
  })
    .then((response) => {
      if (!response.ok) {
        logger.warn('Instagram webhook relay rejected', { status: response.status })
      }
    })
    .catch((error: unknown) => {
      logger.warn('Instagram webhook relay failed', {
        error: error instanceof Error ? error.message : String(error),
      })
    })
}
