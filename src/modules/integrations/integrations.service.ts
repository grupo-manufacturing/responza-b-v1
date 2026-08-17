import { exchangeWhatsAppAccessToken, fetchWhatsAppBusinessProfile } from '../../platforms/whatsapp/index.js'
import {
  exchangeInstagramAccessToken,
  fetchInstagramUserInfo,
  subscribeInstagramWebhooks,
} from '../../platforms/instagram/index.js'
import {
  exchangeGmailAccessToken,
  fetchGmailProfile,
  revokeGmailToken,
} from '../../platforms/gmail/index.js'
import { backfillInstagramParticipantProfiles } from '../../platforms/instagram/enrichment.js'
import type { AuthContext } from '../../shared/auth/index.js'
import { AppError } from '../../shared/errors/index.js'
import { logger } from '../../shared/logger.js'
import { syncChannel } from '../inbox/inbox.service.js'
import {
  getGmailCredentialsForOrganization,
  getInstagramCredentialsForOrganization,
  getWhatsAppCredentialsForOrganization,
} from './credentials.service.js'
import {
  SUPPORTED_PLATFORMS,
  integrationPlatformFromApi,
  type IntegrationPlatform,
  type GmailIntegrationMetadata,
  type InstagramIntegrationMetadata,
  type WhatsAppIntegrationMetadata,
} from './integrations.constants.js'
import type { ConnectIntegrationBody } from './integrations.schemas.js'
import {
  gmailIntegrationMetadataSchema,
  whatsAppIntegrationMetadataSchema,
  whatsAppSessionInfoSchema,
  instagramIntegrationMetadataSchema,
} from './integrations.schemas.js'
import * as integrationsRepository from './integrations.repository.js'
import type { IntegrationRecord } from './integrations.repository.js'

function toIntegrationResponse(record: IntegrationRecord) {
  return {
    id: record.id,
    platform: record.platform,
    status: record.status,
  }
}

function toDisconnectedResponse(platform: IntegrationPlatform) {
  return {
    platform,
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

function toGmailSummary(metadata: GmailIntegrationMetadata) {
  return {
    email: metadata.email,
    display_name: metadata.display_name ?? null,
    profile_picture_url: metadata.profile_picture_url ?? null,
  }
}

const CHANNEL_DISPLAY_NAMES: Record<'whatsapp' | 'instagram', string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
}

export async function listIntegrations(auth: AuthContext) {
  const [rows, whatsapp, instagram, gmail] = await Promise.all([
    integrationsRepository.listIntegrationsByOrganization(auth.organizationId),
    storedWhatsAppSummary(auth.organizationId),
    storedInstagramSummary(auth.organizationId),
    storedGmailSummary(auth.organizationId),
  ])

  const byPlatform = new Map(rows.map((row) => [row.platform, row]))

  const integrations = SUPPORTED_PLATFORMS.map((platform) => {
    const row = byPlatform.get(platform)
    if (row === undefined) {
      return toDisconnectedResponse(platform)
    }

    return toIntegrationResponse(row)
  })

  return {
    integrations,
    whatsapp,
    instagram,
    gmail,
  }
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
    case 'gmail':
      return connectGmailIntegration(auth, body)
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

  await subscribeInstagramWebhooks({
    businessAccountId: userInfo.business_account_id,
    accessToken,
  })

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

async function connectGmailIntegration(auth: AuthContext, body: ConnectIntegrationBody) {
  const code = body.code?.trim()
  if (code === undefined || code.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'code is required')
  }

  const tokenResult = await exchangeGmailAccessToken(code, body.redirect_uri)
  const profile = await fetchGmailProfile(tokenResult.accessToken)

  const metadata = gmailIntegrationMetadataSchema.parse({
    email: profile.email,
    google_user_id: profile.google_user_id,
    display_name: profile.display_name,
    profile_picture_url: profile.profile_picture_url,
    scopes: tokenResult.scopes,
    history_id: profile.history_id,
  })

  return storeGmailCredentials(auth.organizationId, {
    accessToken: tokenResult.accessToken,
    refreshToken: tokenResult.refreshToken!,
    tokenExpiresAt: tokenResult.expiresAt?.toISOString() ?? null,
    metadata,
  })
}

export async function disconnectIntegration(auth: AuthContext, platformParam: string) {
  const platform = integrationPlatformFromApi(platformParam)

  if (platform === 'gmail') {
    const credentials = await getGmailCredentialsForOrganization(auth.organizationId)
    const revokeToken = credentials?.refreshToken ?? credentials?.accessToken
    if (revokeToken !== undefined && revokeToken !== null && revokeToken.length > 0) {
      await revokeGmailToken(revokeToken)
    }
  }

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
  } catch (error) {
    logger.warn('[whatsapp] profile enrich failed', {
      phoneNumberId: metadata.phone_number_id,
      error: error instanceof Error ? error.message : String(error),
    })
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

async function storeGmailCredentials(
  organizationId: string,
  input: {
    accessToken: string
    refreshToken: string
    tokenExpiresAt: string | null
    metadata: GmailIntegrationMetadata
  },
) {
  const metadata = gmailIntegrationMetadataSchema.parse(input.metadata)
  const accessToken = input.accessToken.trim()
  const refreshToken = input.refreshToken.trim()

  if (accessToken.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'access_token is required')
  }

  if (refreshToken.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'refresh_token is required')
  }

  const integration = await integrationsRepository.upsertGmailCredentials(organizationId, {
    accessToken,
    refreshToken,
    tokenExpiresAt: input.tokenExpiresAt,
    metadata,
  })

  return {
    integration: toIntegrationResponse(integration),
    gmail: toGmailSummary(metadata),
  }
}

async function storedWhatsAppSummary(organizationId: string) {
  const credentials = await getWhatsAppCredentialsForOrganization(organizationId)
  if (credentials === null) {
    return null
  }

  return toWhatsAppSummary(credentials.metadata as WhatsAppIntegrationMetadata)
}

async function storedInstagramSummary(organizationId: string) {
  const credentials = await getInstagramCredentialsForOrganization(organizationId)
  if (credentials === null) {
    return null
  }

  return toInstagramSummary(credentials.metadata as InstagramIntegrationMetadata)
}

async function storedGmailSummary(organizationId: string) {
  const credentials = await getGmailCredentialsForOrganization(organizationId)
  if (credentials === null) {
    return null
  }

  return toGmailSummary(credentials.metadata)
}

export async function getWhatsAppConnectionSummary(auth: AuthContext) {
  const credentials = await getWhatsAppCredentialsForOrganization(auth.organizationId)
  if (credentials === null) {
    return {
      connected: false,
      whatsapp: null,
    }
  }

  const metadata = await enrichWhatsAppMetadata(
    credentials.metadata as WhatsAppIntegrationMetadata,
    credentials.accessToken,
  )

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
  } catch (error) {
    logger.warn('[instagram] status profile refresh failed', {
      organizationId: auth.organizationId,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return {
    connected: true,
    instagram: toInstagramSummary(metadata, profilePictureUrl),
  }
}

export async function getGmailConnectionSummary(auth: AuthContext) {
  const gmail = await storedGmailSummary(auth.organizationId)

  return {
    connected: gmail !== null,
    gmail,
  }
}
