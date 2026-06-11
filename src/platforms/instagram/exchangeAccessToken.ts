import { parseGraphApiError } from '../shared/graphErrors.js'
import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'

type InstagramTokenResponse = {
  access_token?: string
  user_id?: string
}

type InstagramLongLivedTokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
}

function normalizeOAuthCode(code: string): string {
  return code.trim().replace(/#_$/, '')
}

export async function exchangeInstagramAccessToken(
  code: string,
  redirectUriOverride?: string,
): Promise<string> {
  const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI } = loadEnv()
  const trimmedCode = normalizeOAuthCode(code)
  const redirectUri = (redirectUriOverride ?? INSTAGRAM_REDIRECT_URI).trim()

  if (trimmedCode.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'code is required')
  }

  if (INSTAGRAM_APP_ID.length === 0 || INSTAGRAM_APP_SECRET.length === 0 || redirectUri.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Instagram app credentials are required on server')
  }

  const form = new URLSearchParams()
  form.append('client_id', INSTAGRAM_APP_ID)
  form.append('client_secret', INSTAGRAM_APP_SECRET)
  form.append('grant_type', 'authorization_code')
  form.append('redirect_uri', redirectUri)
  form.append('code', trimmedCode)

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: form.toString(),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  })

  if (!response.ok) {
    const message = await parseGraphApiError(response, 'Instagram token exchange failed')
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const data = (await response.json()) as InstagramTokenResponse
  const shortLivedToken = data.access_token

  if (typeof shortLivedToken !== 'string' || shortLivedToken.trim().length === 0) {
    throw new AppError(502, 'INTERNAL_ERROR', 'Instagram returned no access_token')
  }

  try {
    const longLivedUrl = new URL('https://graph.instagram.com/access_token')
    longLivedUrl.searchParams.set('grant_type', 'ig_exchange_token')
    longLivedUrl.searchParams.set('client_secret', INSTAGRAM_APP_SECRET)
    longLivedUrl.searchParams.set('access_token', shortLivedToken.trim())

    const longLivedResponse = await fetch(longLivedUrl)

    if (longLivedResponse.ok) {
      const longLivedData = (await longLivedResponse.json()) as InstagramLongLivedTokenResponse
      const longLivedToken = longLivedData.access_token

      if (typeof longLivedToken === 'string' && longLivedToken.trim().length > 0) {
        return longLivedToken.trim()
      }
    }
  } catch {
    return shortLivedToken.trim()
  }

  return shortLivedToken.trim()
}

type InstagramUserResponse = {
  id?: string
  user_id?: string
  username?: string
  account_type?: string
  profile_picture_url?: string
}

export async function fetchInstagramUserInfo(accessToken: string): Promise<{
  business_account_id: string
  user_id: string
  username?: string
  profile_picture_url?: string
}> {
  const userResponse = await fetch(
    `https://graph.instagram.com/me?fields=user_id,username,account_type,profile_picture_url&access_token=${encodeURIComponent(accessToken)}`,
  )

  if (!userResponse.ok) {
    const errorText = await userResponse.text()
    throw new AppError(502, 'BAD_REQUEST', `Failed to fetch Instagram user info: ${errorText}`)
  }

  const user = (await userResponse.json()) as InstagramUserResponse

  const userId = user.user_id ?? user.id
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new AppError(502, 'BAD_REQUEST', 'Instagram user ID not found')
  }

  return {
    business_account_id: userId,
    user_id: userId,
    username: user.username,
    profile_picture_url: user.profile_picture_url,
  }
}
