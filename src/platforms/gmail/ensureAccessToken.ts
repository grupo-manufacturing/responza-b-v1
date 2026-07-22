import { getGmailCredentialsForOrganization } from '../../modules/integrations/credentials.service.js'
import { updateGmailAccessToken } from '../../modules/integrations/repositories/gmail.repository.js'
import { AppError } from '../../shared/errors/index.js'
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
    throw new AppError(402, 'INTEGRATIONS_REQUIRED', 'Connect Gmail in Integrations to continue.')
  }

  if (!isTokenExpired(credentials.tokenExpiresAt)) {
    return credentials.accessToken
  }

  const refreshToken = credentials.refreshToken
  if (refreshToken === null || refreshToken.trim().length === 0) {
    throw new AppError(
      502,
      'BAD_REQUEST',
      'Gmail refresh token is missing. Reconnect Gmail in Integrations.',
    )
  }

  const refreshed = await refreshGmailAccessToken(refreshToken)
  await updateGmailAccessToken(organizationId, {
    accessToken: refreshed.accessToken,
    tokenExpiresAt: refreshed.expiresAt?.toISOString() ?? null,
  })

  return refreshed.accessToken
}
