import type { IntegrationPlatform } from '../modules/integrations/integrations.constants.js'
import type { MessageContentType } from '../modules/inbox/inbox.schemas.js'

export type SendMessageResult = {
  platformMessageId: string | null
  platformMediaId?: string | null
}

export type OutboundMediaContentType = Exclude<MessageContentType, 'text'>

export type OutboundMessageInput = {
  platform: IntegrationPlatform
  organizationId: string
  integrationId: string
  recipientExternalId: string
  content: string
  contentType: MessageContentType
  media?: {
    storagePath: string
    mimeType: string
    filename?: string | null
  }
}

