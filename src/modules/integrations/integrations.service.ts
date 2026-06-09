import type { AuthContext } from '../../shared/auth/index.js'
import {
  SUPPORTED_PLATFORMS,
  integrationPlatformFromApi,
  integrationPlatformToApi,
  integrationStatusToApi,
} from './integrations.constants.js'
import type { IntegrationPlatform } from './integrations.constants.js'
import type { ConnectIntegrationBody } from './integrations.schemas.js'
import * as integrationsRepository from './integrations.repository.js'
import type { IntegrationRecord } from './integrations.repository.js'

function toIntegrationResponse(record: IntegrationRecord) {
  return {
    id: record.id,
    platform: integrationPlatformToApi(record.platform),
    status: integrationStatusToApi(record.status),
  }
}

function toDisconnectedResponse(platform: IntegrationPlatform) {
  return {
    platform: integrationPlatformToApi(platform),
    status: 'disconnected' as const,
  }
}

export async function listIntegrations(auth: AuthContext) {
  const rows = await integrationsRepository.listIntegrationsByOrganization(auth.organizationId)
  const byPlatform = new Map(rows.map((row) => [row.platform, row]))

  const integrations = SUPPORTED_PLATFORMS.map((platform) => {
    const row = byPlatform.get(platform)
    if (row === undefined) {
      return toDisconnectedResponse(platform)
    }

    return toIntegrationResponse(row)
  })

  return { integrations }
}

export async function connectIntegration(
  auth: AuthContext,
  platformParam: string,
  _body: ConnectIntegrationBody,
) {
  const platform = integrationPlatformFromApi(platformParam)
  const updated = await integrationsRepository.setIntegrationConnected(
    auth.organizationId,
    platform,
  )

  return {
    integration: toIntegrationResponse(updated),
  }
}

export async function disconnectIntegration(auth: AuthContext, platformParam: string) {
  const platform = integrationPlatformFromApi(platformParam)
  const updated = await integrationsRepository.setIntegrationDisconnected(
    auth.organizationId,
    platform,
  )

  return {
    integration: toIntegrationResponse(updated),
  }
}
