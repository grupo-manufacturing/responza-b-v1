export const INTEGRATION_PLATFORMS = ['whatsapp', 'instagram', 'indiamart'] as const

export type IntegrationPlatform = (typeof INTEGRATION_PLATFORMS)[number]

export const INTEGRATION_STATUSES = ['connected', 'disconnected'] as const

export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number]

export const SUPPORTED_PLATFORMS: ReadonlyArray<{
  platform: IntegrationPlatform
  label: string
}> = [
  { platform: 'whatsapp', label: 'WhatsApp' },
  { platform: 'instagram', label: 'Instagram' },
  { platform: 'indiamart', label: 'IndiaMART' },
]

export function isIntegrationPlatform(value: string): value is IntegrationPlatform {
  return (INTEGRATION_PLATFORMS as readonly string[]).includes(value)
}
