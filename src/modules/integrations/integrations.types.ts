export type WhatsAppIntegrationMetadata = {
  phone_number_id: string
  waba_id: string
  business_id?: string
}

export type InstagramIntegrationMetadata = {
  business_account_id: string
  user_id: string
  username?: string
}

export type IntegrationCredentials = {
  integrationId: string
  organizationId: string
  accessToken: string
  metadata: WhatsAppIntegrationMetadata | InstagramIntegrationMetadata
}
