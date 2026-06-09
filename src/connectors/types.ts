import type { IntegrationPlatform } from '../modules/integrations/integrations.constants.js'

export type SendTextMessageResult = {
  platformMessageId: string | null
}

export type OutboundTextMessageInput = {
  platform: IntegrationPlatform
  organizationId: string
  integrationId: string
  recipientExternalId: string
  content: string
}

export interface Connector {
  readonly platform: IntegrationPlatform
  sendTextMessage(input: {
    to: string
    content: string
    phoneNumberId: string
    accessToken: string
  }): Promise<SendTextMessageResult>
}
