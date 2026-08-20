import * as integrationsRepository from '../../integrations/integrations.repository.js'
import type { IntegrationPlatform } from '../../integrations/integrations.constants.js'

export type IntegrationStatusSnapshot = {
  connected: IntegrationPlatform[]
  disconnected: IntegrationPlatform[]
}

export async function getIntegrationStatusSnapshot(
  organizationId: string,
): Promise<IntegrationStatusSnapshot> {
  const integrations = await integrationsRepository.listIntegrationsByOrganization(organizationId)

  const connected: IntegrationPlatform[] = []
  const disconnected: IntegrationPlatform[] = []

  for (const integration of integrations) {
    if (integration.status === 'connected') {
      connected.push(integration.platform)
    } else {
      disconnected.push(integration.platform)
    }
  }

  return { connected, disconnected }
}

export const getIntegrationStatusToolDefinition = {
  type: 'function' as const,
  function: {
    name: 'get_integration_status',
    description:
      'Returns which integrations (whatsapp, instagram, gmail) are connected or disconnected for this organization.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
}
