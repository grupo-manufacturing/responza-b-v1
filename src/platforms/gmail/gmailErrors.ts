import { AppError, isAppError } from '../../shared/errors/index.js'

export const GMAIL_NOT_CONNECTED_MESSAGE = 'Connect Gmail in Integrations to continue.'
export const GMAIL_REVOKED_MESSAGE =
  'Gmail access was revoked. Reconnect Gmail in Integrations.'
export const GMAIL_UNAVAILABLE_MESSAGE =
  'Gmail is temporarily unavailable. Please try again shortly.'
export const GMAIL_NETWORK_FAILURE_MESSAGE =
  'Could not reach Gmail. Check your connection and try again.'

export function isGmailRevokedError(error: unknown): boolean {
  return (
    isAppError(error) &&
    error.code === 'INTEGRATIONS_REQUIRED' &&
    error.message === GMAIL_REVOKED_MESSAGE
  )
}

export function isGmailNotConnectedError(error: unknown): boolean {
  return (
    isAppError(error) &&
    error.code === 'INTEGRATIONS_REQUIRED' &&
    error.message === GMAIL_NOT_CONNECTED_MESSAGE
  )
}

export function throwGmailUnavailable(): never {
  throw new AppError(503, 'BAD_REQUEST', GMAIL_UNAVAILABLE_MESSAGE)
}

export function throwGmailNetworkFailure(): never {
  throw new AppError(503, 'BAD_REQUEST', GMAIL_NETWORK_FAILURE_MESSAGE)
}

export function throwGmailRevokedError(): never {
  throw new AppError(402, 'INTEGRATIONS_REQUIRED', GMAIL_REVOKED_MESSAGE)
}

export function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false
  }

  const message = error.message.toLowerCase()
  return (
    error.name === 'AbortError' ||
    message.includes('fetch failed') ||
    message.includes('network') ||
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('socket')
  )
}

type GoogleOAuthErrorBody = {
  error?: string
  error_description?: string
}

export function parseGoogleOAuthErrorBody(raw: string): GoogleOAuthErrorBody {
  try {
    return JSON.parse(raw) as GoogleOAuthErrorBody
  } catch {
    return {}
  }
}

export function isInvalidRefreshTokenResponse(body: GoogleOAuthErrorBody): boolean {
  const error = body.error?.trim().toLowerCase() ?? ''
  return error === 'invalid_grant' || error === 'invalid_client'
}

export function mapGoogleOAuthHttpStatusToAppError(status: number): AppError | null {
  if (status === 401 || status === 403) {
    return new AppError(402, 'INTEGRATIONS_REQUIRED', GMAIL_REVOKED_MESSAGE)
  }

  if (status >= 500) {
    return new AppError(503, 'BAD_REQUEST', GMAIL_UNAVAILABLE_MESSAGE)
  }

  return null
}

export function mapGmailApiStatusToAppError(status: number, message: string): AppError {
  if (status === 401 || status === 403) {
    return new AppError(402, 'INTEGRATIONS_REQUIRED', GMAIL_REVOKED_MESSAGE)
  }

  if (status === 404) {
    return new AppError(404, 'NOT_FOUND', 'Email not found')
  }

  if (status === 429) {
    return new AppError(429, 'RATE_LIMITED', 'Gmail rate limit exceeded. Please try again shortly.')
  }

  if (status >= 500) {
    return new AppError(503, 'BAD_REQUEST', GMAIL_UNAVAILABLE_MESSAGE)
  }

  return new AppError(502, 'BAD_REQUEST', message)
}
