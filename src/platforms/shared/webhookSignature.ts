import { createHmac, timingSafeEqual } from 'node:crypto'

type SignatureAlgorithm = 'sha1' | 'sha256'

export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
  algorithm: SignatureAlgorithm,
): boolean {
  const prefix = `${algorithm}=`
  if (signatureHeader === undefined || !signatureHeader.startsWith(prefix)) {
    return false
  }

  const providedHex = signatureHeader.slice(prefix.length).trim()
  if (providedHex.length === 0 || appSecret.trim().length === 0) {
    return false
  }

  const expectedHex = createHmac(algorithm, appSecret).update(rawBody).digest('hex')

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
