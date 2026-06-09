import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'

type InstagramMeResponse = {
  user_id?: string | number
  username?: string
}

type InstagramLongLivedTokenResponse = {
  access_token?: string
}

type GraphErrorBody = {
  error?: {
    message?: string
  }
}

async function parseGraphError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as GraphErrorBody
    const message = body.error?.message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  } catch {
    // ignore parse errors
  }

  return `Instagram API request failed (${response.status})`
}

async function fetchInstagramMe(accessToken: string): Promise<InstagramMeResponse> {
  const url = new URL('https://graph.instagram.com/me')
  url.searchParams.set('fields', 'user_id,username')
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url)
  if (!response.ok) {
    const message = await parseGraphError(response)
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  return (await response.json()) as InstagramMeResponse
}

async function exchangeLongLivedInstagramToken(shortLivedToken: string): Promise<string> {
  const { INSTAGRAM_APP_SECRET } = loadEnv()
  if (INSTAGRAM_APP_SECRET.trim().length === 0) {
    return shortLivedToken
  }

  const url = new URL('https://graph.instagram.com/access_token')
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', INSTAGRAM_APP_SECRET)
  url.searchParams.set('access_token', shortLivedToken)

  try {
    const response = await fetch(url)
    if (!response.ok) {
      return shortLivedToken
    }

    const data = (await response.json()) as InstagramLongLivedTokenResponse
    const accessToken = data.access_token
    if (typeof accessToken === 'string' && accessToken.trim().length > 0) {
      return accessToken.trim()
    }
  } catch {
    // keep short-lived token
  }

  return shortLivedToken
}

async function subscribeInstagramApp(igUserId: string, accessToken: string): Promise<void> {
  const { SYSTEM_USER_TOKEN, WHATSAPP_GRAPH_VERSION } = loadEnv()
  const bearer = SYSTEM_USER_TOKEN.trim().length > 0 ? SYSTEM_USER_TOKEN.trim() : accessToken

  try {
    await fetch(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/${igUserId}/subscribed_apps`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
      },
    })
  } catch {
    // optional for some setups
  }
}

export type InstagramOnboardedUser = {
  accessToken: string
  igUserId: string
  igUsername: string
}

export async function onboardInstagramUser(
  accessToken: string,
  userId: string | null,
): Promise<InstagramOnboardedUser> {
  const rawToken = accessToken.trim()
  if (rawToken.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'access_token is required')
  }

  const me = await fetchInstagramMe(rawToken)
  const resolvedUserId =
    userId?.trim() ||
    (typeof me.user_id === 'string'
      ? me.user_id.trim()
      : typeof me.user_id === 'number'
        ? String(me.user_id)
        : '')

  if (resolvedUserId.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'Instagram user_id could not be resolved from token')
  }

  await subscribeInstagramApp(resolvedUserId, rawToken)

  const longLivedToken = await exchangeLongLivedInstagramToken(rawToken)
  const username =
    typeof me.username === 'string' && me.username.trim().length > 0
      ? me.username.trim()
      : resolvedUserId

  return {
    accessToken: longLivedToken,
    igUserId: resolvedUserId,
    igUsername: username,
  }
}
