import { createHmac, timingSafeEqual } from 'node:crypto'

import { loadEnv } from '../../shared/config/index.js'

export function verifyWhatsAppWebhookSignature(signatureHeader: string, rawBody: string): boolean {
  const env = loadEnv()
  const appSecret = env.META_APP_SECRET.trim()

  if (appSecret.length === 0 || signatureHeader.length === 0 || rawBody.length === 0) {
    return false
  }

  if (!signatureHeader.startsWith('sha256=')) {
    return false
  }

  const received = signatureHeader.slice('sha256='.length)
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')

  if (received.length !== expected.length) {
    return false
  }

  return timingSafeEqual(Buffer.from(received, 'utf8'), Buffer.from(expected, 'utf8'))
}
