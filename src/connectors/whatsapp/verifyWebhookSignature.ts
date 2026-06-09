import { createHmac, timingSafeEqual } from 'node:crypto'

export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (signatureHeader === undefined || !signatureHeader.startsWith('sha256=')) {
    return false
  }

  const providedHex = signatureHeader.slice('sha256='.length).trim()
  if (providedHex.length === 0 || appSecret.trim().length === 0) {
    return false
  }

  const expectedHex = createHmac('sha256', appSecret).update(rawBody).digest('hex')

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
