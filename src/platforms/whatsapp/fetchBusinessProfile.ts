import { parseGraphApiError } from '../shared/graphErrors.js'
import { loadEnv } from '../../shared/config/index.js'

type WhatsAppBusinessProfile = {
  verified_name: string | null
  display_phone_number: string | null
  profile_picture_url: string | null
}

type PhoneNumberFields = {
  verified_name?: string
  display_phone_number?: string
}

type BusinessProfileResponse = {
  data?: Array<{ profile_picture_url?: string }>
}

export async function fetchWhatsAppBusinessProfile(input: {
  phoneNumberId: string
  accessToken: string
}): Promise<WhatsAppBusinessProfile> {
  const phoneNumberId = input.phoneNumberId.trim()
  const accessToken = input.accessToken.trim()
  const { WHATSAPP_GRAPH_VERSION } = loadEnv()
  const baseUrl = `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`

  const headers = {
    Authorization: `Bearer ${accessToken}`,
  }

  const [phoneResult, profileResult] = await Promise.allSettled([
    fetch(`${baseUrl}/${phoneNumberId}?fields=verified_name,display_phone_number`, { headers }),
    fetch(`${baseUrl}/${phoneNumberId}/whatsapp_business_profile?fields=profile_picture_url`, {
      headers,
    }),
  ])

  let verified_name: string | null = null
  let display_phone_number: string | null = null
  let profile_picture_url: string | null = null

  if (phoneResult.status === 'fulfilled' && phoneResult.value.ok) {
    const phoneData = (await phoneResult.value.json()) as PhoneNumberFields
    verified_name =
      typeof phoneData.verified_name === 'string' && phoneData.verified_name.length > 0
        ? phoneData.verified_name
        : null
    display_phone_number =
      typeof phoneData.display_phone_number === 'string' &&
      phoneData.display_phone_number.length > 0
        ? phoneData.display_phone_number
        : null
  }

  if (profileResult.status === 'fulfilled' && profileResult.value.ok) {
    const profileData = (await profileResult.value.json()) as BusinessProfileResponse
    const pictureUrl = profileData.data?.[0]?.profile_picture_url
    profile_picture_url =
      typeof pictureUrl === 'string' && pictureUrl.length > 0 ? pictureUrl : null
  } else if (profileResult.status === 'fulfilled' && !profileResult.value.ok) {
    await parseGraphApiError(profileResult.value, 'WhatsApp profile request failed').catch(
      () => undefined,
    )
  }

  return {
    verified_name,
    display_phone_number,
    profile_picture_url,
  }
}
