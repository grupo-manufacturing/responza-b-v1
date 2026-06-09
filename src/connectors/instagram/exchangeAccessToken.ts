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

type InstagramErrorBody = {
  error?: {
    message?: string
    type?: string
    code?: number
  }
}

async function parseInstagramError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as InstagramErrorBody
    const message = body.error?.message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  } catch {
    // ignore parse errors
  }

  return `Instagram token exchange failed (${response.status})`
}

export async function exchangeInstagramAccessToken(code: string): Promise<string> {
  const { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI } = loadEnv()
  const trimmedCode = code.trim()

  if (trimmedCode.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'code is required')
  }

  if (INSTAGRAM_APP_ID.length === 0 || INSTAGRAM_APP_SECRET.length === 0 || INSTAGRAM_REDIRECT_URI.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Instagram app credentials are required on server')
  }

  // Step 1: Exchange authorization code for short-lived token
  const form = new URLSearchParams()
  form.append('client_id', INSTAGRAM_APP_ID)
  form.append('client_secret', INSTAGRAM_APP_SECRET)
  form.append('grant_type', 'authorization_code')
  form.append('redirect_uri', INSTAGRAM_REDIRECT_URI)
  form.append('code', trimmedCode)

  const response = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: form,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  })

  if (!response.ok) {
    const message = await parseInstagramError(response)
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const data = (await response.json()) as InstagramTokenResponse
  const shortLivedToken = data.access_token

  if (typeof shortLivedToken !== 'string' || shortLivedToken.trim().length === 0) {
    throw new AppError(502, 'INTERNAL_ERROR', 'Instagram returned no access_token')
  }

  // Step 2: Exchange short-lived token for long-lived token
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
    // Fall back to short-lived token if long-lived exchange fails
  }

  return shortLivedToken.trim()
}

type InstagramUserResponse = {
  id?: string
  username?: string
  account_type?: string
}

export async function fetchInstagramUserInfo(accessToken: string): Promise<{
  business_account_id: string
  user_id: string
  username?: string
}> {
  const userResponse = await fetch(`https://graph.instagram.com/me?fields=id,username,account_type&access_token=${accessToken}`)
  
  if (!userResponse.ok) {
    const errorText = await userResponse.text()
    throw new AppError(502, 'BAD_REQUEST', `Failed to fetch Instagram user info: ${errorText}`)
  }
  
  const user: InstagramUserResponse = await userResponse.json()
  
  if (!user.id) {
    throw new AppError(502, 'BAD_REQUEST', 'Instagram user ID not found')
  }

  // For now, use the user ID as the business account ID
  // In a production setup, you'd fetch the actual business account info
  return {
    business_account_id: user.id,
    user_id: user.id,
    username: user.username
  }
}