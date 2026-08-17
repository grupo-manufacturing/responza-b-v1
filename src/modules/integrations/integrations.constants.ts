export const SUPPORTED_PLATFORMS = ['whatsapp', 'instagram', 'gmail'] as const

export type IntegrationPlatform = (typeof SUPPORTED_PLATFORMS)[number]
export type IntegrationStatus = 'connected' | 'disconnected'

export type WhatsAppIntegrationMetadata = {
  phone_number_id: string
  waba_id: string
  business_id?: string
  verified_name?: string
  display_phone_number?: string
  profile_picture_url?: string
}

export type InstagramIntegrationMetadata = {
  business_account_id: string
  user_id: string
  username?: string
  profile_picture_url?: string
}

export type GmailIntegrationMetadata = {
  email: string
  google_user_id?: string
  display_name?: string
  profile_picture_url?: string
  scopes?: string[]
  history_id?: string
  watch_expiration?: string
}

export type IntegrationCredentials = {
  integrationId: string
  organizationId: string
  accessToken: string
  metadata: WhatsAppIntegrationMetadata | InstagramIntegrationMetadata | GmailIntegrationMetadata
}

export type GmailIntegrationCredentials = IntegrationCredentials & {
  refreshToken: string | null
  tokenExpiresAt: string | null
  metadata: GmailIntegrationMetadata
}

export function integrationPlatformFromApi(platform: string): IntegrationPlatform {
  if ((SUPPORTED_PLATFORMS as readonly string[]).includes(platform)) {
    return platform as IntegrationPlatform
  }

  throw new Error(`Invalid integration platform: ${platform}`)
}
