import { exchangeWhatsAppAccessToken } from '../../connectors/whatsapp/exchangeAccessToken.js'
import { exchangeInstagramAccessToken, fetchInstagramUserInfo } from '../../connectors/instagram/exchangeAccessToken.js'
import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import * as inboxRepository from '../inbox/inbox.repository.js'
import {
  SUPPORTED_PLATFORMS,
  integrationPlatformFromApi,
  integrationPlatformToApi,
  integrationStatusToApi,
} from './integrations.constants.js'
import type { IntegrationPlatform } from './integrations.constants.js'
import type { ConnectIntegrationBody } from './integrations.schemas.js'
import { whatsAppIntegrationMetadataSchema, whatsAppSessionInfoSchema, instagramIntegrationMetadataSchema } from './integrations.schemas.js'
import * as integrationsRepository from './integrations.repository.js'
import type { IntegrationRecord } from './integrations.repository.js'
import { toIntegrationCredentials } from './integrations.repository.js'
import type { IntegrationCredentials, WhatsAppIntegrationMetadata, InstagramIntegrationMetadata } from './integrations.types.js'

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

function toWhatsAppSummary(metadata: WhatsAppIntegrationMetadata) {
  return {
    phone_number_id: metadata.phone_number_id,
    waba_id: metadata.waba_id,
    business_id: metadata.business_id ?? null,
  }
}

function toInstagramSummary(metadata: InstagramIntegrationMetadata) {
  return {
    business_account_id: metadata.business_account_id,
    user_id: metadata.user_id,
    username: metadata.username ?? null,
  }
}

async function syncWhatsAppChannel(organizationId: string, integrationId: string) {
  const existing = await inboxRepository.findChannelByIntegration({
    organizationId,
    integrationId,
  })

  if (existing !== null) {
    return existing
  }

  return inboxRepository.insertChannel({
    organization_id: organizationId,
    integration_id: integrationId,
    platform: 'whatsapp',
    display_name: 'WhatsApp',
  })
}

async function syncInstagramChannel(organizationId: string, integrationId: string) {
  const existing = await inboxRepository.findChannelByIntegration({
    organizationId,
    integrationId,
  })

  if (existing !== null) {
    return existing
  }

  return inboxRepository.insertChannel({
    organization_id: organizationId,
    integration_id: integrationId,
    platform: 'instagram',
    display_name: 'Instagram',
  })
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
  body: ConnectIntegrationBody,
) {
  const platform = integrationPlatformFromApi(platformParam)

  switch (platform) {
    case 'whatsapp':
      return connectWhatsAppIntegration(auth, body)
    case 'instagram':
      return connectInstagramIntegration(auth, body)
    case 'indiamart':
      throw new AppError(501, 'NOT_IMPLEMENTED', `${integrationPlatformToApi(platform)} connect is not implemented yet`)
    default:
      throw new AppError(400, 'BAD_REQUEST', `Unsupported platform: ${platform}`)
  }
}

async function connectWhatsAppIntegration(auth: AuthContext, body: ConnectIntegrationBody) {
  const code = body.code?.trim()
  if (code === undefined || code.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'code is required')
  }

  const sessionInfo = whatsAppSessionInfoSchema.parse(body.session_info ?? {})

  const accessToken = await exchangeWhatsAppAccessToken(code)
  const metadata = whatsAppIntegrationMetadataSchema.parse({
    phone_number_id: sessionInfo.phone_number_id,
    waba_id: sessionInfo.waba_id,
    business_id: sessionInfo.business_id,
  })

  const result = await storeWhatsAppCredentials(auth.organizationId, {
    accessToken,
    metadata,
  })

  await syncWhatsAppChannel(auth.organizationId, result.integration.id)

  return result
}

async function connectInstagramIntegration(auth: AuthContext, body: ConnectIntegrationBody) {
  const code = body.code?.trim()
  if (code === undefined || code.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'code is required')
  }

  const accessToken = await exchangeInstagramAccessToken(code)
  
  // Fetch user info using the access token
  const userInfo = await fetchInstagramUserInfo(accessToken)
  
  const metadata = instagramIntegrationMetadataSchema.parse({
    business_account_id: userInfo.business_account_id,
    user_id: userInfo.user_id,
    username: userInfo.username,
  })

  const result = await storeInstagramCredentials(auth.organizationId, {
    accessToken,
    metadata,
  })

  await syncInstagramChannel(auth.organizationId, result.integration.id)

  return result
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

export async function storeWhatsAppCredentials(
  organizationId: string,
  input: {
    accessToken: string
    metadata: WhatsAppIntegrationMetadata
  },
) {
  const metadata = whatsAppIntegrationMetadataSchema.parse(input.metadata)
  const accessToken = input.accessToken.trim()

  if (accessToken.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'access_token is required')
  }

  const integration = await integrationsRepository.upsertWhatsAppCredentials(organizationId, {
    accessToken,
    metadata,
  })

  return {
    integration: toIntegrationResponse(integration),
    whatsapp: toWhatsAppSummary(metadata),
  }
}

export async function storeInstagramCredentials(
  organizationId: string,
  input: {
    accessToken: string
    metadata: InstagramIntegrationMetadata
  },
) {
  const metadata = instagramIntegrationMetadataSchema.parse(input.metadata)
  const accessToken = input.accessToken.trim()

  if (accessToken.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'access_token is required')
  }

  const integration = await integrationsRepository.upsertInstagramCredentials(organizationId, {
    accessToken,
    metadata,
  })

  return {
    integration: toIntegrationResponse(integration),
    instagram: toInstagramSummary(metadata),
  }
}

export async function getWhatsAppCredentialsForOrganization(
  organizationId: string,
): Promise<IntegrationCredentials | null> {
  const row = await integrationsRepository.findWhatsAppCredentialsByOrganization(organizationId)
  if (row === null) {
    return null
  }

  return toIntegrationCredentials(row)
}

export async function resolveWhatsAppIntegrationByPhoneNumberId(
  phoneNumberId: string,
): Promise<IntegrationCredentials | null> {
  const normalized = phoneNumberId.trim()
  if (normalized.length === 0) {
    return null
  }

  const row = await integrationsRepository.findConnectedWhatsAppByPhoneNumberId(normalized)
  if (row === null) {
    return null
  }

  return toIntegrationCredentials(row)
}

export async function resolveWhatsAppIntegrationByWabaId(
  wabaId: string,
): Promise<IntegrationCredentials | null> {
  const normalized = wabaId.trim()
  if (normalized.length === 0) {
    return null
  }

  const row = await integrationsRepository.findConnectedWhatsAppByWabaId(normalized)
  if (row === null) {
    return null
  }

  return toIntegrationCredentials(row)
}

export async function getInstagramCredentialsForOrganization(
  organizationId: string,
): Promise<IntegrationCredentials | null> {
  const row = await integrationsRepository.findInstagramCredentialsByOrganization(organizationId)
  if (row === null) {
    return null
  }

  return toIntegrationCredentials(row)
}

export async function resolveInstagramIntegrationByBusinessId(
  businessAccountId: string,
): Promise<IntegrationCredentials | null> {
  const normalized = businessAccountId.trim()
  if (normalized.length === 0) {
    return null
  }

  const row = await integrationsRepository.findConnectedInstagramByBusinessId(normalized)
  if (row === null) {
    return null
  }

  return toIntegrationCredentials(row)
}

export async function getWhatsAppConnectionSummary(auth: AuthContext) {
  const credentials = await getWhatsAppCredentialsForOrganization(auth.organizationId)
  if (credentials === null) {
    return {
      connected: false,
      whatsapp: null,
    }
  }

  return {
    connected: true,
    whatsapp: toWhatsAppSummary(credentials.metadata as WhatsAppIntegrationMetadata),
  }
}

export async function getInstagramConnectionSummary(auth: AuthContext) {
  const credentials = await getInstagramCredentialsForOrganization(auth.organizationId)
  if (credentials === null) {
    return {
      connected: false,
      instagram: null,
    }
  }

  return {
    connected: true,
    instagram: toInstagramSummary(credentials.metadata as InstagramIntegrationMetadata),
  }
}
