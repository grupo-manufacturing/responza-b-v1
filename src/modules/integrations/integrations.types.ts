export type WhatsAppIntegrationMetadata = {
  phone_number_id: string
  waba_id: string
  business_id?: string
}

export type IntegrationCredentials = {
  integrationId: string
  organizationId: string
  accessToken: string
  metadata: WhatsAppIntegrationMetadata
}
