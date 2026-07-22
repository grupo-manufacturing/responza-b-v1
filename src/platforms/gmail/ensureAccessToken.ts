import { getGmailCredentialsForOrganization } from '../../modules/integrations/credentials.service.js'
import { updateGmailAccessToken } from '../../modules/integrations/repositories/gmail.repository.js'
import { AppError } from '../../shared/errors/index.js'
import { disconnectGmailAndThrowRevoked } from './gmailAuthFailure.js'
import { GMAIL_NOT_CONNECTED_MESSAGE, isGmailRevokedError } from './gmailErrors.js'
import { refreshGmailAccessToken } from './refreshAccessToken.js'

const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000

function isTokenExpired(tokenExpiresAt: string | null): boolean {
  if (tokenExpiresAt === null) {
    return true
  }

  const expiresAtMs = Date.parse(tokenExpiresAt)
  if (Number.isNaN(expiresAtMs)) {
    return true
  }

  return expiresAtMs <= Date.now() + TOKEN_EXPIRY_BUFFER_MS
}

export async function ensureValidGmailAccessToken(organizationId: string): Promise<string> {
  const credentials = await getGmailCredentialsForOrganization(organizationId)
  if (credentials === null) {
    throw new AppError(402, 'INTEGRATIONS_REQUIRED', GMAIL_NOT_CONNECTED_MESSAGE)
  }

  if (!isTokenExpired(credentials.tokenExpiresAt)) {
    return credentials.accessToken
  }

  const refreshToken = credentials.refreshToken
  if (refreshToken === null || refreshToken.trim().length === 0) {
    return disconnectGmailAndThrowRevoked(organizationId)
  }

  try {
    const refreshed = await refreshGmailAccessToken(refreshToken)
    await updateGmailAccessToken(organizationId, {
      accessToken: refreshed.accessToken,
      tokenExpiresAt: refreshed.expiresAt?.toISOString() ?? null,
    })

    return refreshed.accessToken
  } catch (error: unknown) {
    if (isGmailRevokedError(error)) {
      return disconnectGmailAndThrowRevoked(organizationId)
    }

    throw error
  }
}
