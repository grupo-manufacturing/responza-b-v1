import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import {
  isInvalidRefreshTokenResponse,
  isNetworkFetchError,
  mapGoogleOAuthHttpStatusToAppError,
  parseGoogleOAuthErrorBody,
  throwGmailNetworkFailure,
  throwGmailRevokedError,
} from './gmailErrors.js'

type GoogleRefreshTokenResponse = {
  access_token?: string
  expires_in?: number
  scope?: string
  token_type?: string
}

type GmailRefreshTokenResult = {
  accessToken: string
  expiresAt: Date | null
}

export async function refreshGmailAccessToken(refreshToken: string): Promise<GmailRefreshTokenResult> {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = loadEnv()
  const trimmedRefreshToken = refreshToken.trim()

  if (GOOGLE_CLIENT_ID.length === 0 || GOOGLE_CLIENT_SECRET.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Google OAuth credentials are required on server')
  }

  if (trimmedRefreshToken.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'refresh_token is required')
  }

  const form = new URLSearchParams()
  form.append('client_id', GOOGLE_CLIENT_ID)
  form.append('client_secret', GOOGLE_CLIENT_SECRET)
  form.append('grant_type', 'refresh_token')
  form.append('refresh_token', trimmedRefreshToken)

  let response: Response
  try {
    response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: form.toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    })
  } catch (error: unknown) {
    if (isNetworkFetchError(error)) {
      throwGmailNetworkFailure()
    }

    throw error
  }

  if (!response.ok) {
    const errorText = await response.text()
    const oauthError = parseGoogleOAuthErrorBody(errorText)

    if (isInvalidRefreshTokenResponse(oauthError)) {
      throwGmailRevokedError()
    }

    const mappedStatusError = mapGoogleOAuthHttpStatusToAppError(response.status)
    if (mappedStatusError !== null) {
      throw mappedStatusError
    }

    throw new AppError(
      502,
      'BAD_REQUEST',
      'Failed to refresh Gmail access token. Please try again.',
    )
  }

  const data = (await response.json()) as GoogleRefreshTokenResponse
  const accessToken = data.access_token?.trim() ?? ''

  if (accessToken.length === 0) {
    throw new AppError(502, 'INTERNAL_ERROR', 'Google returned no access_token during refresh')
  }

  const expiresAt =
    typeof data.expires_in === 'number' && Number.isFinite(data.expires_in)
      ? new Date(Date.now() + data.expires_in * 1000)
      : null

  return {
    accessToken,
    expiresAt,
  }
}
