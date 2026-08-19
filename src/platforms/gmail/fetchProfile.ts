import { AppError } from '../../shared/errors/index.js'
import { gmailApiFetch } from './gmailApi.js'

type GoogleUserInfoResponse = {
  id?: string
  email?: string
  name?: string
  picture?: string
}

type GmailProfileResponse = {
  emailAddress?: string
  historyId?: string
}

export async function fetchGmailProfile(accessToken: string) {
  const profile = await gmailApiFetch<GmailProfileResponse>(accessToken, 'users/me/profile')
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
