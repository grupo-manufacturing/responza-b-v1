import {
  mapGmailApiStatusToAppError,
  throwGmailNetworkFailure,
} from './gmailErrors.js'

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

export async function gmailApiFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = path.startsWith('https://')
    ? path
    : `https://gmail.googleapis.com/gmail/v1/${path.replace(/^\//, '')}`

  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throwGmailNetworkFailure()
  }

  if (!response.ok) {
    let body: GmailApiErrorBody = {}
    try {
      body = (await response.json()) as GmailApiErrorBody
    } catch {
      body = {}
    }

    throw mapGmailApiStatusToAppError(
      response.status,
      gmailApiErrorMessage(body, `Gmail API request failed (${response.status})`),
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}
