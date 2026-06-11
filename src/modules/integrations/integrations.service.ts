import { exchangeWhatsAppAccessToken } from '../../platforms/whatsapp/exchangeAccessToken.js'
import { exchangeInstagramAccessToken, fetchInstagramUserInfo } from '../../platforms/instagram/exchangeAccessToken.js'
import { backfillInstagramParticipantProfiles } from '../../platforms/instagram/enrichment.js'
import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import { logger } from '../../shared/logger.js'
import { syncChannel } from '../inbox/inbox.service.js'
import {
  getInstagramCredentialsForOrganization,
  getWhatsAppCredentialsForOrganization,
} from './credentials.service.js'
import {
  SUPPORTED_PLATFORMS,
  integrationPlatformFromApi,
  integrationPlatformToApi,
  integrationStatusToApi,
  type IntegrationPlatform,
  type InstagramIntegrationMetadata,
  type WhatsAppIntegrationMetadata,
} from './integrations.constants.js'
import type { ConnectIntegrationBody } from './integrations.schemas.js'
import { whatsAppIntegrationMetadataSchema, whatsAppSessionInfoSchema, instagramIntegrationMetadataSchema } from './integrations.schemas.js'
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

const CHANNEL_DISPLAY_NAMES: Record<'whatsapp' | 'instagram', string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
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

  await syncChannel(auth.organizationId, result.integration.id, 'whatsapp', CHANNEL_DISPLAY_NAMES.whatsapp)

  return result
}

async function connectInstagramIntegration(auth: AuthContext, body: ConnectIntegrationBody) {
  const code = body.code?.trim()
  if (code === undefined || code.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'code is required')
  }

  const accessToken = await exchangeInstagramAccessToken(code, body.redirect_uri)
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

  await syncChannel(auth.organizationId, result.integration.id, 'instagram', CHANNEL_DISPLAY_NAMES.instagram)
  await backfillInstagramParticipantProfiles(auth.organizationId).catch((error: unknown) => {
    logger.warn('[instagram] profile backfill after connect failed', {
      organizationId: auth.organizationId,
      error: error instanceof Error ? error.message : String(error),
    })
  })

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

async function storeWhatsAppCredentials(
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

async function storeInstagramCredentials(
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
