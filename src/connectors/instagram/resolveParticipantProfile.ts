import { loadEnv } from '../../shared/config/index.js'

export type InstagramParticipantProfile = {
  username: string | null
  name: string | null
  avatarUrl: string | null
}

type InstagramProfileResponse = {
  name?: string
  username?: string
  profile_pic?: string
  error?: {
    message?: string
    type?: string
    code?: number
  }
}

export function formatInstagramParticipantDisplayName(profile: InstagramParticipantProfile): string | null {
  if (profile.username !== null) {
    const handle = profile.username.replace(/^@/, '').trim()
    if (handle.length > 0) {
      return `@${handle}`
    }
  }

  if (profile.name !== null && profile.name.trim().length > 0) {
    return profile.name.trim()
  }

  return null
}

async function fetchInstagramProfile(
  igsid: string,
  accessToken: string,
  graphVersion: string,
): Promise<InstagramParticipantProfile | null> {
  const url = new URL(`https://graph.instagram.com/${graphVersion}/${igsid}`)
  url.searchParams.set('fields', 'name,username,profile_pic')
  url.searchParams.set('access_token', accessToken)

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  const rawBody = await response.text()
  if (!response.ok) {
    console.warn('[instagram] profile lookup failed', {
      igsid,
      status: response.status,
      body: rawBody.slice(0, 400),
    })
    return null
  }

  let data: InstagramProfileResponse
  try {
    data = JSON.parse(rawBody) as InstagramProfileResponse
  } catch {
    return null
  }

  if (data.error !== undefined) {
    console.warn('[instagram] profile lookup error', { igsid, error: data.error })
    return null
  }

  const username =
    typeof data.username === 'string' && data.username.trim().length > 0
      ? data.username.trim()
      : null
  const name =
    typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : null
  const avatarUrl =
    typeof data.profile_pic === 'string' && data.profile_pic.trim().length > 0
      ? data.profile_pic.trim()
      : null

  if (username === null && name === null && avatarUrl === null) {
    return null
  }

  return { username, name, avatarUrl }
}

export async function resolveInstagramParticipantProfile(input: {
  igsid: string
  accessToken: string
}): Promise<InstagramParticipantProfile | null> {
  const { INSTAGRAM_GRAPH_VERSION } = loadEnv()
  const igsid = input.igsid.trim()
  const accessToken = input.accessToken.trim()

  if (igsid.length === 0 || accessToken.length === 0) {
    return null
  }

  // Instagram API with Instagram Login — graph.instagram.com only.
  // https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api/user-profile
  const profile = await fetchInstagramProfile(igsid, accessToken, INSTAGRAM_GRAPH_VERSION)
  if (profile !== null) {
    return profile
  }

  // Retry once with Bearer header (some token formats behave better this way).
  const url = new URL(`https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${igsid}`)
  url.searchParams.set('fields', 'name,username,profile_pic')

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as InstagramProfileResponse
    if (data.error !== undefined) {
      return null
    }

    const username =
      typeof data.username === 'string' && data.username.trim().length > 0
        ? data.username.trim()
        : null
    const name =
      typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : null
    const avatarUrl =
      typeof data.profile_pic === 'string' && data.profile_pic.trim().length > 0
        ? data.profile_pic.trim()
        : null

    if (username === null && name === null && avatarUrl === null) {
      return null
    }

    return { username, name, avatarUrl }
  } catch {
    return null
  }
}
