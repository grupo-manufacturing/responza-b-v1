export const SUPPORTED_PLATFORMS = ['whatsapp', 'instagram', 'indiamart'] as const

export const INTEGRATION_STATUS_VALUES = ['connected', 'disconnected'] as const

export type IntegrationPlatform = (typeof SUPPORTED_PLATFORMS)[number]
export type IntegrationStatus = (typeof INTEGRATION_STATUS_VALUES)[number]

export type WhatsAppIntegrationMetadata = {
  phone_number_id: string
  waba_id: string
  business_id?: string
}

export type InstagramIntegrationMetadata = {
  business_account_id: string
  user_id: string
  username?: string
  profile_picture_url?: string
}

export type IntegrationCredentials = {
  integrationId: string
  organizationId: string
  accessToken: string
  metadata: WhatsAppIntegrationMetadata | InstagramIntegrationMetadata
}

const PLATFORM_TO_API: Record<IntegrationPlatform, string> = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  indiamart: 'indiamart',
}

const PLATFORM_FROM_API: Record<string, IntegrationPlatform> = {
  whatsapp: 'whatsapp',
  instagram: 'instagram',
  indiamart: 'indiamart',
}

const STATUS_TO_API: Record<IntegrationStatus, string> = {
  connected: 'connected',
  disconnected: 'disconnected',
}

export function integrationPlatformToApi(platform: IntegrationPlatform): string {
  return PLATFORM_TO_API[platform]
}

export function integrationPlatformFromApi(platform: string): IntegrationPlatform {
  const mapped = PLATFORM_FROM_API[platform]
  if (mapped === undefined) {
    throw new Error(`Invalid integration platform: ${platform}`)
  }

  return mapped
}

export function integrationStatusToApi(status: IntegrationStatus): string {
  return STATUS_TO_API[status]
}

export function isSupportedPlatform(platform: string): platform is IntegrationPlatform {
  return SUPPORTED_PLATFORMS.includes(platform as IntegrationPlatform)
}
