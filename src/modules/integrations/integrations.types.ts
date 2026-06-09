export type WhatsAppIntegrationMetadata = {
  phone_number_id: string
  waba_id: string
  business_id?: string
}

export type InstagramIntegrationMetadata = {
  ig_user_id: string
  ig_username: string
  messaging_account_id?: string
}

export type WhatsAppIntegrationCredentials = {
  integrationId: string
  organizationId: string
  accessToken: string
  metadata: WhatsAppIntegrationMetadata
}

export type InstagramIntegrationCredentials = {
  integrationId: string
  organizationId: string
  accessToken: string
  metadata: InstagramIntegrationMetadata
}

/** @deprecated Use WhatsAppIntegrationCredentials for new code */
export type IntegrationCredentials = WhatsAppIntegrationCredentials
