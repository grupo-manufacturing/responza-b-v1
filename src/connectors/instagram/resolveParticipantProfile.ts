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
  profile_picture_url?: string
  error?: {
    message?: string
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

  const profileUrls = [
    new URL(`https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}/${igsid}`),
    new URL(`https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${igsid}`),
  ]

  profileUrls[0].searchParams.set('fields', 'name,username,profile_pic')
  profileUrls[1].searchParams.set('fields', 'name,username,profile_picture_url')

  for (const profileUrl of profileUrls) {
    profileUrl.searchParams.set('access_token', accessToken)

    try {
      const response = await fetch(profileUrl)
      if (!response.ok) {
        continue
      }

      const data = (await response.json()) as InstagramProfileResponse
      if (data.error !== undefined) {
        continue
      }

      const username =
        typeof data.username === 'string' && data.username.trim().length > 0
          ? data.username.trim()
          : null
      const name =
        typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : null
      const avatarUrl =
        (typeof data.profile_pic === 'string' && data.profile_pic.trim().length > 0
          ? data.profile_pic.trim()
          : null) ??
        (typeof data.profile_picture_url === 'string' && data.profile_picture_url.trim().length > 0
          ? data.profile_picture_url.trim()
          : null)

      if (username !== null || name !== null || avatarUrl !== null) {
        return { username, name, avatarUrl }
      }
    } catch {
      continue
    }
  }

  return null
}
