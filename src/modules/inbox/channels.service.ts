import * as integrationsRepository from '../integrations/integrations.repository.js'
import { defaultChannelDisplayName } from './inbox.constants.js'
import * as inboxRepository from './inbox.repository.js'

/**
 * Ensures a channel row exists for every connected integration.
 * Called after mock/real connect and before inbox list operations.
 */
export async function syncChannelsFromConnectedIntegrations(
  organizationId: string,
): Promise<void> {
  const integrations = await integrationsRepository.listIntegrationsByOrganization(organizationId)
  const connected = integrations.filter((integration) => integration.status === 'connected')

  await Promise.all(
    connected.map((integration) => {
      const phoneNumberId =
        integration.platform === 'whatsapp' &&
        typeof integration.metadata.phone_number_id === 'string'
          ? integration.metadata.phone_number_id
          : undefined

      return inboxRepository.upsertChannel({
        organization_id: organizationId,
        integration_id: integration.id,
        platform: integration.platform,
        display_name:
          phoneNumberId !== undefined
            ? `WhatsApp ${phoneNumberId}`
            : defaultChannelDisplayName(integration.platform),
        metadata:
          integration.platform === 'whatsapp'
            ? {
                phone_number_id: integration.metadata.phone_number_id,
                waba_id: integration.metadata.waba_id,
              }
            : {},
      })
    }),
  )
}
