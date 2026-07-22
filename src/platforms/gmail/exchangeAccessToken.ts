import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'

const REQUIRED_GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.send',
] as const

type GoogleTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

export type GmailTokenExchangeResult = {
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scopes: string[]
}

function normalizeOAuthCode(code: string): string {
  return code.trim().replace(/#_$/, '')
}

function parseScopes(scope: string | undefined): string[] {
  if (scope === undefined || scope.trim().length === 0) {
    return []
  }

  return scope.trim().split(/\s+/).filter((value) => value.length > 0)
}

function validateGmailScopes(scopes: string[]): void {
  const missing = REQUIRED_GMAIL_SCOPES.filter((required) => !scopes.includes(required))
  if (missing.length > 0) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Gmail authorization is missing required permissions. Please grant all requested access.',
      { missing_scopes: missing },
    )
  }
}

export async function exchangeGmailAccessToken(
  code: string,
  redirectUriOverride?: string,
): Promise<GmailTokenExchangeResult> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GMAIL_REDIRECT_URI } = loadEnv()
  const trimmedCode = normalizeOAuthCode(code)
  const redirectUri = (redirectUriOverride ?? GMAIL_REDIRECT_URI).trim()

  if (trimmedCode.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'code is required')
  }

  if (GOOGLE_CLIENT_ID.length === 0 || GOOGLE_CLIENT_SECRET.length === 0 || redirectUri.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Google OAuth credentials are required on server')
  }

  const form = new URLSearchParams()
  form.append('client_id', GOOGLE_CLIENT_ID)
  form.append('client_secret', GOOGLE_CLIENT_SECRET)
  form.append('grant_type', 'authorization_code')
  form.append('redirect_uri', redirectUri)
  form.append('code', trimmedCode)

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: form.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new AppError(502, 'BAD_REQUEST', `Gmail token exchange failed: ${errorText}`)
  }

  const data = (await response.json()) as GoogleTokenResponse
  const accessToken = data.access_token?.trim() ?? ''

  if (accessToken.length === 0) {
    throw new AppError(502, 'INTERNAL_ERROR', 'Google returned no access_token')
  }

  const scopes = parseScopes(data.scope)
  validateGmailScopes(scopes)

  const refreshToken =
    typeof data.refresh_token === 'string' && data.refresh_token.trim().length > 0
      ? data.refresh_token.trim()
      : null

  if (refreshToken === null) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Gmail refresh token was not returned. Revoke app access in your Google account and try again.',
    )
  }

  const expiresAt =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? new Date(Date.now() + data.expires_in * 1000)
      : null

  return {
    accessToken,
    refreshToken,
    expiresAt,
    scopes,
  }
}
