import type { AuthContext } from '../../shared/auth/index.js'
import { exchangeWhatsAppConnectCode } from '../../connectors/whatsapp/index.js'
import { AppError } from '../../shared/errors/index.js'
import { getLogger } from '../../shared/logger/index.js'
import {
  getIntegrationsListCache,
  invalidateIntegrationsListCache,
  setIntegrationsListCache,
  type CachedIntegrationSummary,
} from './integrations.cache.js'
import { syncChannelsFromConnectedIntegrations } from '../inbox/channels.service.js'
import {
  INTEGRATION_PLATFORMS,
  SUPPORTED_PLATFORMS,
  type IntegrationPlatform,
} from './integrations.constants.js'
import type { IntegrationConnectBody } from './integrations.schemas.js'
import * as integrationsRepository from './integrations.repository.js'
import type { IntegrationRecord } from './integrations.repository.js'
import {
  normalizeWhatsAppMetadata,
  toPublicWhatsAppMetadata,
  type IntegrationPublicMetadata,
} from './integrations.types.js'

export type IntegrationResponse = {
  platform: IntegrationPlatform
  status: IntegrationRecord['status']
  connectedAt: string | null
  disconnectedAt: string | null
  updatedAt: string | null
  metadata?: IntegrationPublicMetadata
}

function toIntegrationResponse(
  record: IntegrationRecord | null,
  platform: IntegrationPlatform,
  options: { includeMetadata?: boolean } = {},
): IntegrationResponse {
  if (record === null) {
    return {
      platform,
      status: 'disconnected',
      connectedAt: null,
      disconnectedAt: null,
      updatedAt: null,
    }
  }

  const response: IntegrationResponse = {
    platform: record.platform,
    status: record.status,
    connectedAt: record.connected_at,
    disconnectedAt: record.disconnected_at,
    updatedAt: record.updated_at,
  }

  if (options.includeMetadata === true && record.platform === 'whatsapp') {
    const metadata = toPublicWhatsAppMetadata(record.metadata)
    if (metadata !== undefined) {
      response.metadata = metadata
    }
  }

  return response
}

function toCachedSummary(integration: IntegrationResponse): CachedIntegrationSummary {
  return {
    platform: integration.platform,
    status: integration.status,
    connectedAt: integration.connectedAt,
    disconnectedAt: integration.disconnectedAt,
    updatedAt: integration.updatedAt,
    ...(integration.metadata !== undefined ? { metadata: integration.metadata } : {}),
  }
}

async function buildIntegrationList(organizationId: string): Promise<IntegrationResponse[]> {
  const records = await integrationsRepository.listIntegrationsByOrganization(organizationId)
  const recordByPlatform = new Map(records.map((record) => [record.platform, record]))

  return INTEGRATION_PLATFORMS.map((platform) =>
    toIntegrationResponse(recordByPlatform.get(platform) ?? null, platform, {
      includeMetadata: platform === 'whatsapp',
    }),
  )
}

async function refreshIntegrationsCache(organizationId: string): Promise<IntegrationResponse[]> {
  const integrations = await buildIntegrationList(organizationId)
  await setIntegrationsListCache(organizationId, integrations.map(toCachedSummary))
  return integrations
}

function logIntegrationEvent(
  action: 'connect' | 'disconnect',
  auth: AuthContext,
  platform: IntegrationPlatform,
): void {
  getLogger().info(
    {
      action,
      organizationId: auth.organizationId,
      platform,
    },
    `Integration ${action}`,
  )
}

async function connectMockIntegration(auth: AuthContext, platform: IntegrationPlatform) {
  const existing = await integrationsRepository.findIntegrationByPlatform(
    auth.organizationId,
    platform,
  )

  if (existing?.status === 'connected') {
    return {
      integration: toIntegrationResponse(existing, platform),
    }
  }

  const now = new Date().toISOString()

  const connected = await integrationsRepository.upsertIntegration({
    organization_id: auth.organizationId,
    platform,
    status: 'connected',
    connected_at: now,
    disconnected_at: null,
    access_token: null,
    metadata: {},
  })

  logIntegrationEvent('connect', auth, platform)
  await invalidateIntegrationsListCache(auth.organizationId)
  await syncChannelsFromConnectedIntegrations(auth.organizationId)

  return {
    integration: toIntegrationResponse(connected, platform),
  }
}

async function connectWhatsAppIntegration(auth: AuthContext, body: IntegrationConnectBody) {
  const code = body.code?.trim() ?? ''
  if (code.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'code is required for WhatsApp connect')
  }

  const sessionInfo =
    body.session_info !== undefined ? normalizeWhatsAppMetadata(body.session_info) : null

  if (
    sessionInfo === null ||
    sessionInfo.phone_number_id.length === 0 ||
    sessionInfo.waba_id.length === 0
  ) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'session_info.phone_number_id and session_info.waba_id are required',
    )
  }

  const accessToken = await exchangeWhatsAppConnectCode(code)
  const now = new Date().toISOString()
  const existing = await integrationsRepository.findIntegrationByPlatform(
    auth.organizationId,
    'whatsapp',
  )

  const connected = await integrationsRepository.upsertIntegration({
    organization_id: auth.organizationId,
    platform: 'whatsapp',
    status: 'connected',
    connected_at: existing?.connected_at ?? now,
    disconnected_at: null,
    access_token: accessToken,
    metadata: sessionInfo,
  })

  logIntegrationEvent('connect', auth, 'whatsapp')
  await invalidateIntegrationsListCache(auth.organizationId)
  await syncChannelsFromConnectedIntegrations(auth.organizationId)

  return {
    integration: toIntegrationResponse(connected, 'whatsapp', { includeMetadata: true }),
  }
}

export async function listIntegrations(auth: AuthContext) {
  const cached = await getIntegrationsListCache(auth.organizationId)
  if (cached !== null) {
    return {
      integrations: cached,
      availablePlatforms: SUPPORTED_PLATFORMS,
    }
  }

  const integrations = await refreshIntegrationsCache(auth.organizationId)

  return {
    integrations,
    availablePlatforms: SUPPORTED_PLATFORMS,
  }
}

export async function connectIntegration(
  auth: AuthContext,
  platform: IntegrationPlatform,
  body: IntegrationConnectBody = {},
) {
  if (platform === 'whatsapp') {
    return connectWhatsAppIntegration(auth, body)
  }

  return connectMockIntegration(auth, platform)
}

export async function disconnectIntegration(auth: AuthContext, platform: IntegrationPlatform) {
  const existing = await integrationsRepository.findIntegrationByPlatform(
    auth.organizationId,
    platform,
  )

  if (existing === null || existing.status !== 'connected') {
    throw new AppError(404, 'NOT_FOUND', 'Integration not found or already disconnected')
  }

  const now = new Date().toISOString()

  const disconnected = await integrationsRepository.upsertIntegration({
    organization_id: auth.organizationId,
    platform,
    status: 'disconnected',
    connected_at: existing.connected_at,
    disconnected_at: now,
    access_token: null,
    metadata: {},
  })

  logIntegrationEvent('disconnect', auth, platform)
  await invalidateIntegrationsListCache(auth.organizationId)

  return {
    integration: toIntegrationResponse(disconnected, platform),
  }
}

export async function hasConnectedIntegration(
  organizationId: string,
  platform?: IntegrationPlatform,
): Promise<boolean> {
  const count = await integrationsRepository.countConnectedIntegrations(organizationId, platform)
  return count > 0
}

export async function assertHasConnectedIntegration(
  auth: AuthContext,
  platform?: IntegrationPlatform,
): Promise<void> {
  const connected = await hasConnectedIntegration(auth.organizationId, platform)

  if (connected) {
    return
  }

  const integrations = await buildIntegrationList(auth.organizationId)
  const disconnectedPlatforms = integrations
    .filter((integration) => integration.status !== 'connected')
    .map((integration) => integration.platform)

  throw new AppError(402, 'INTEGRATIONS_REQUIRED', 'Connect a platform to access this feature', {
    requiredPlatform: platform ?? null,
    availablePlatforms: SUPPORTED_PLATFORMS.map((entry) => entry.platform),
    disconnectedPlatforms,
  })
}
