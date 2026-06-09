import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyInstagramWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string
): boolean {
  if (signatureHeader === undefined || !signatureHeader.startsWith('sha1=')) {
    return false
  }

  const providedHex = signatureHeader.slice('sha1='.length).trim()
  if (providedHex.length === 0 || appSecret.trim().length === 0) {
    return false
  }

  const expectedHex = createHmac('sha1', appSecret).update(rawBody).digest('hex')

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