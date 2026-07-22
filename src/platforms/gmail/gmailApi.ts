import { AppError } from '../../shared/errors/index.js'

type GmailApiErrorBody = {
  error?: {
    code?: number
    message?: string
    status?: string
    errors?: Array<{ message?: string; reason?: string }>
  }
}

function gmailApiErrorMessage(body: GmailApiErrorBody, fallback: string): string {
  const message = body.error?.message?.trim()
  if (message !== undefined && message.length > 0) {
    return message
  }

  const firstReason = body.error?.errors?.[0]?.message?.trim()
  if (firstReason !== undefined && firstReason.length > 0) {
    return firstReason
  }

  return fallback
}

function mapGmailStatusToAppError(status: number, message: string): AppError {
  if (status === 401 || status === 403) {
    return new AppError(502, 'BAD_REQUEST', 'Gmail authorization failed. Reconnect Gmail in Integrations.')
  }

  if (status === 404) {
    return new AppError(404, 'NOT_FOUND', 'Email not found')
  }

  if (status === 429) {
    return new AppError(429, 'RATE_LIMITED', 'Gmail rate limit exceeded. Please try again shortly.')
  }

  return new AppError(502, 'BAD_REQUEST', message)
}

export async function gmailApiFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith('https://')
    ? path
    : `https://gmail.googleapis.com/gmail/v1/${path.replace(/^\//, '')}`

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    let body: GmailApiErrorBody = {}
    try {
      body = (await response.json()) as GmailApiErrorBody
    } catch {
      body = {}
    }

    throw mapGmailStatusToAppError(
      response.status,
      gmailApiErrorMessage(body, `Gmail API request failed (${response.status})`),
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
