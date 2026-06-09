import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'

type InstagramTokenExchangeResponse = {
  access_token?: string
  user_id?: string | number
}

type InstagramErrorBody = {
  error_message?: string
  error_type?: string
}

async function parseInstagramOAuthError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as InstagramErrorBody
    if (typeof body.error_message === 'string' && body.error_message.length > 0) {
      return body.error_message
    }
  } catch {
    // ignore parse errors
  }

  return `Instagram token exchange failed (${response.status})`
}

export type InstagramShortLivedToken = {
  accessToken: string
  userId: string | null
}

export async function exchangeInstagramAuthorizationCode(code: string): Promise<InstagramShortLivedToken> {
  const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI } = loadEnv()
  const trimmedCode = code.trim().replace(/#_$/, '')

  if (trimmedCode.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'code is required')
  }

  if (INSTAGRAM_APP_ID.length === 0 || INSTAGRAM_APP_SECRET.length === 0) {
    throw new AppError(
      500,
      'INTERNAL_ERROR',
      'INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET are required on server',
    )
  }

  if (INSTAGRAM_REDIRECT_URI.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'INSTAGRAM_REDIRECT_URI is required on server')
  }

  const form = new URLSearchParams()
  form.set('client_id', INSTAGRAM_APP_ID)
  form.set('client_secret', INSTAGRAM_APP_SECRET)
  form.set('grant_type', 'authorization_code')
  form.set('redirect_uri', INSTAGRAM_REDIRECT_URI)
  form.set('code', trimmedCode)

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  })

  if (!response.ok) {
    const message = await parseInstagramOAuthError(response)
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const data = (await response.json()) as InstagramTokenExchangeResponse
  const accessToken = data.access_token

  if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    throw new AppError(502, 'INTERNAL_ERROR', 'Instagram token exchange returned no access_token')
  }

  const rawUserId = data.user_id
  const userId =
    typeof rawUserId === 'string'
      ? rawUserId.trim()
      : typeof rawUserId === 'number'
        ? String(rawUserId)
        : null

  return {
    accessToken: accessToken.trim(),
    userId: userId !== null && userId.length > 0 ? userId : null,
  }
}
