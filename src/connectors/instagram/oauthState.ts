import { createHmac, timingSafeEqual } from 'node:crypto'

import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'

const STATE_TTL_MS = 15 * 60 * 1000

type OAuthStatePayload = {
  organizationId: string
  expiresAt: number
}

function oauthStateSigningSecret(): string {
  const { INSTAGRAM_APP_SECRET, META_APP_SECRET } = loadEnv()
  const instagramSecret = INSTAGRAM_APP_SECRET.trim()
  if (instagramSecret.length > 0) {
    return instagramSecret
  }

  return META_APP_SECRET.trim()
}

function signEncodedPayload(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

function signaturesMatch(provided: string, expected: string): boolean {
  try {
    const providedBuffer = Buffer.from(provided, 'base64url')
    const expectedBuffer = Buffer.from(expected, 'base64url')
    if (providedBuffer.length !== expectedBuffer.length) {
      return false
    }

    return timingSafeEqual(providedBuffer, expectedBuffer)
  } catch {
    return false
  }
}

export function signInstagramOAuthState(organizationId: string): string {
  const secret = oauthStateSigningSecret()
  if (secret.length === 0) {
    throw new AppError(
      500,
      'INTERNAL_ERROR',
      'INSTAGRAM_APP_SECRET or META_APP_SECRET is required for OAuth state signing',
    )
  }

  const payload: OAuthStatePayload = {
    organizationId,
    expiresAt: Date.now() + STATE_TTL_MS,
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = signEncodedPayload(encodedPayload, secret)
  return `${encodedPayload}.${signature}`
}

export function verifyInstagramOAuthState(state: string): string {
  const secret = oauthStateSigningSecret()
  if (secret.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'OAuth state signing secret is not configured')
  }

  const trimmedState = state.trim()
  const separatorIndex = trimmedState.lastIndexOf('.')
  if (separatorIndex <= 0) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid OAuth state')
  }

  const encodedPayload = trimmedState.slice(0, separatorIndex)
  const providedSignature = trimmedState.slice(separatorIndex + 1)
  const expectedSignature = signEncodedPayload(encodedPayload, secret)

  if (!signaturesMatch(providedSignature, expectedSignature)) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid OAuth state')
  }

  let payload: OAuthStatePayload
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as OAuthStatePayload
  } catch {
    throw new AppError(403, 'FORBIDDEN', 'Invalid OAuth state')
  }

  if (
    typeof payload.organizationId !== 'string' ||
    payload.organizationId.trim().length === 0 ||
    typeof payload.expiresAt !== 'number'
  ) {
    throw new AppError(403, 'FORBIDDEN', 'Invalid OAuth state')
  }

  if (Date.now() > payload.expiresAt) {
    throw new AppError(403, 'FORBIDDEN', 'OAuth state has expired')
  }

  return payload.organizationId.trim()
}
