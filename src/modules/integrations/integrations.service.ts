import { exchangeWhatsAppAccessToken, fetchWhatsAppBusinessProfile } from '../../platforms/whatsapp/index.js'
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
    display_name: metadata.verified_name ?? metadata.display_phone_number ?? null,
    profile_picture_url: metadata.profile_picture_url ?? null,
  }
}

function toInstagramSummary(
  metadata: InstagramIntegrationMetadata,
  profilePictureUrl?: string | null,
) {
  return {
    business_account_id: metadata.business_account_id,
    user_id: metadata.user_id,
    username: metadata.username ?? null,
    profile_picture_url: profilePictureUrl ?? metadata.profile_picture_url ?? null,
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
    profile_picture_url: userInfo.profile_picture_url,
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

async function enrichWhatsAppMetadata(
  metadata: WhatsAppIntegrationMetadata,
  accessToken: string,
): Promise<WhatsAppIntegrationMetadata> {
  try {
    const profile = await fetchWhatsAppBusinessProfile({
      phoneNumberId: metadata.phone_number_id,
      accessToken,
    })

    return whatsAppIntegrationMetadataSchema.parse({
      ...metadata,
      ...(profile.verified_name !== null ? { verified_name: profile.verified_name } : {}),
      ...(profile.display_phone_number !== null
        ? { display_phone_number: profile.display_phone_number }
        : {}),
      ...(profile.profile_picture_url !== null
        ? { profile_picture_url: profile.profile_picture_url }
        : {}),
    })
  } catch {
    return metadata
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

  const enrichedMetadata = await enrichWhatsAppMetadata(metadata, accessToken)

  const integration = await integrationsRepository.upsertWhatsAppCredentials(organizationId, {
    accessToken,
    metadata: enrichedMetadata,
  })

  return {
    integration: toIntegrationResponse(integration),
    whatsapp: toWhatsAppSummary(enrichedMetadata),
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

  const baseMetadata = credentials.metadata as WhatsAppIntegrationMetadata
  let metadata = baseMetadata

  try {
    const profile = await fetchWhatsAppBusinessProfile({
      phoneNumberId: baseMetadata.phone_number_id,
      accessToken: credentials.accessToken,
    })
    metadata = {
      ...baseMetadata,
      ...(profile.verified_name !== null ? { verified_name: profile.verified_name } : {}),
      ...(profile.display_phone_number !== null
        ? { display_phone_number: profile.display_phone_number }
        : {}),
      ...(profile.profile_picture_url !== null
        ? { profile_picture_url: profile.profile_picture_url }
        : {}),
    }
  } catch {
  }

  return {
    connected: true,
    whatsapp: toWhatsAppSummary(metadata),
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

  const metadata = credentials.metadata as InstagramIntegrationMetadata
  let profilePictureUrl = metadata.profile_picture_url ?? null

  try {
    const userInfo = await fetchInstagramUserInfo(credentials.accessToken)
    profilePictureUrl = userInfo.profile_picture_url ?? profilePictureUrl
  } catch {
  }

  return {
    connected: true,
    instagram: toInstagramSummary(metadata, profilePictureUrl),
  }
}
