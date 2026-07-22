import { AppError } from '../../shared/errors/index.js'

type GmailProfileResponse = {
  emailAddress?: string
  historyId?: string
}

type GoogleUserInfoResponse = {
  id?: string
  email?: string
  name?: string
  picture?: string
}

export type GmailProfile = {
  email: string
  google_user_id?: string
  display_name?: string
  profile_picture_url?: string
  history_id?: string
}

export async function fetchGmailProfile(accessToken: string): Promise<GmailProfile> {
  const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!profileResponse.ok) {
    const errorText = await profileResponse.text()
    throw new AppError(502, 'BAD_REQUEST', `Failed to fetch Gmail profile: ${errorText}`)
  }

  const profile = (await profileResponse.json()) as GmailProfileResponse
  const email = profile.emailAddress?.trim() ?? ''

  if (email.length === 0) {
    throw new AppError(502, 'BAD_REQUEST', 'Gmail email address not found')
  }

  let googleUserId: string | undefined
  let displayName: string | undefined
  let profilePictureUrl: string | undefined

  try {
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (userInfoResponse.ok) {
      const userInfo = (await userInfoResponse.json()) as GoogleUserInfoResponse
      if (typeof userInfo.id === 'string' && userInfo.id.length > 0) {
        googleUserId = userInfo.id
      }
      if (typeof userInfo.name === 'string' && userInfo.name.length > 0) {
        displayName = userInfo.name
      }
      if (typeof userInfo.picture === 'string' && userInfo.picture.length > 0) {
        profilePictureUrl = userInfo.picture
      }
    }
  } catch {
    // Optional enrichment only.
  }

  return {
    email,
    ...(googleUserId !== undefined ? { google_user_id: googleUserId } : {}),
    ...(displayName !== undefined ? { display_name: displayName } : {}),
    ...(profilePictureUrl !== undefined ? { profile_picture_url: profilePictureUrl } : {}),
    ...(typeof profile.historyId === 'string' && profile.historyId.length > 0
      ? { history_id: profile.historyId }
      : {}),
  }
}
