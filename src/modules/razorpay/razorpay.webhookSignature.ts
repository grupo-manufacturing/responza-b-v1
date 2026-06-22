import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyRazorpayWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  webhookSecret: string,
): boolean {
  const secret = webhookSecret.trim()
  const providedHex = signatureHeader?.trim() ?? ''

  if (providedHex.length === 0 || secret.length === 0) {
    return false
  }

  const expectedHex = createHmac('sha256', secret).update(rawBody).digest('hex')

  try {
    const provided = Buffer.from(providedHex, 'hex')
    const expected = Buffer.from(expectedHex, 'hex')
    if (provided.length !== expected.length) {
      return false
    }
    return timingSafeEqual(provided, expected)
  } catch {
    return false
  }
}
