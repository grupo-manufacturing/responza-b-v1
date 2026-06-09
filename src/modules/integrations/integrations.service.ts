import {
  INSTAGRAM_OAUTH_SCOPES,
  exchangeInstagramAuthorizationCode,
  onboardInstagramUser,
  signInstagramOAuthState,
  verifyInstagramOAuthState,
} from '../../connectors/instagram/index.js'
import { exchangeWhatsAppAccessToken } from '../../connectors/whatsapp/exchangeAccessToken.js'
import type { AuthContext } from '../../shared/auth/index.js'
import { loadEnv } from '../../shared/config/index.js'
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
import {
  instagramIntegrationMetadataSchema,
  whatsAppIntegrationMetadataSchema,
  whatsAppSessionInfoSchema,
} from './integrations.schemas.js'
import * as integrationsRepository from './integrations.repository.js'
import type { IntegrationRecord } from './integrations.repository.js'
import {
  toInstagramIntegrationCredentials,
  toWhatsAppIntegrationCredentials,
} from './integrations.repository.js'
import type {
  InstagramIntegrationCredentials,
  InstagramIntegrationMetadata,
  WhatsAppIntegrationCredentials,
  WhatsAppIntegrationMetadata,
} from './integrations.types.js'

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
    ig_user_id: metadata.ig_user_id,
    ig_username: metadata.ig_username,
    messaging_account_id: metadata.messaging_account_id ?? null,
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

async function syncInstagramChannel(
  organizationId: string,
  integrationId: string,
  displayName: string,
) {
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
    display_name: displayName,
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
      throw new AppError(
        400,
        'BAD_REQUEST',
        'Instagram connect uses OAuth. Call GET /api/integrations/instagram/connect-url and complete the popup flow.',
      )
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

export async function getWhatsAppCredentialsForOrganization(
  organizationId: string,
): Promise<WhatsAppIntegrationCredentials | null> {
  const row = await integrationsRepository.findWhatsAppCredentialsByOrganization(organizationId)
  if (row === null) {
    return null
  }

  return toWhatsAppIntegrationCredentials(row)
}

export async function getInstagramConnectUrl(auth: AuthContext) {
  const { INSTAGRAM_APP_ID, INSTAGRAM_REDIRECT_URI } = loadEnv()

  if (INSTAGRAM_APP_ID.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'INSTAGRAM_APP_ID is not configured')
  }

  if (INSTAGRAM_REDIRECT_URI.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'INSTAGRAM_REDIRECT_URI is not configured')
  }

  const state = signInstagramOAuthState(auth.organizationId)
  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('force_reauth', 'true')
  url.searchParams.set('client_id', INSTAGRAM_APP_ID)
  url.searchParams.set('redirect_uri', INSTAGRAM_REDIRECT_URI)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', INSTAGRAM_OAUTH_SCOPES)
  url.searchParams.set('state', state)

  return {
    url: url.toString(),
  }
}

export async function completeInstagramOAuthCallback(input: { code: string; state: string }) {
  const organizationId = verifyInstagramOAuthState(input.state)
  const shortLived = await exchangeInstagramAuthorizationCode(input.code)
  const onboarded = await onboardInstagramUser(shortLived.accessToken, shortLived.userId)

  const channelDisplayName = onboarded.igUsername.startsWith('@')
    ? onboarded.igUsername
    : `@${onboarded.igUsername}`

  const result = await storeInstagramCredentials(organizationId, {
    accessToken: onboarded.accessToken,
    metadata: {
      ig_user_id: onboarded.igUserId,
      ig_username: onboarded.igUsername,
    },
  })

  await syncInstagramChannel(organizationId, result.integration.id, channelDisplayName)

  return {
    ig_user_id: onboarded.igUserId,
    ig_username: onboarded.igUsername,
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

export async function getInstagramCredentialsForOrganization(
  organizationId: string,
): Promise<InstagramIntegrationCredentials | null> {
  const row = await integrationsRepository.findInstagramCredentialsByOrganization(organizationId)
  if (row === null) {
    return null
  }

  return toInstagramIntegrationCredentials(row)
}

export async function resolveInstagramIntegrationByIgUserId(
  igUserId: string,
): Promise<InstagramIntegrationCredentials | null> {
  const normalized = igUserId.trim()
  if (normalized.length === 0) {
    return null
  }

  const row = await integrationsRepository.findConnectedInstagramByIgUserId(normalized)
  if (row === null) {
    return null
  }

  return toInstagramIntegrationCredentials(row)
}

export async function resolveInstagramIntegrationByMessagingAccountId(
  messagingAccountId: string,
): Promise<InstagramIntegrationCredentials | null> {
  const normalized = messagingAccountId.trim()
  if (normalized.length === 0) {
    return null
  }

  const row =
    await integrationsRepository.findConnectedInstagramByMessagingAccountId(normalized)
  if (row === null) {
    return null
  }

  return toInstagramIntegrationCredentials(row)
}

export async function resolveInstagramIntegrationForWebhook(input: {
  messagingAccountId?: string | null
  igUserId?: string | null
}): Promise<InstagramIntegrationCredentials | null> {
  const messagingAccountId = input.messagingAccountId?.trim()
  if (messagingAccountId && messagingAccountId.length > 0) {
    const byMessagingAccount =
      await resolveInstagramIntegrationByMessagingAccountId(messagingAccountId)
    if (byMessagingAccount !== null) {
      return byMessagingAccount
    }
  }

  const igUserId = input.igUserId?.trim()
  if (igUserId && igUserId.length > 0) {
    return resolveInstagramIntegrationByIgUserId(igUserId)
  }

  return null
}

export async function updateInstagramMessagingAccountId(
  organizationId: string,
  messagingAccountId: string,
): Promise<InstagramIntegrationCredentials | null> {
  const normalized = messagingAccountId.trim()
  if (normalized.length === 0) {
    return null
  }

  const updated = await integrationsRepository.updateInstagramMessagingAccountId(
    organizationId,
    normalized,
  )
  if (updated === null) {
    return null
  }

  return getInstagramCredentialsForOrganization(organizationId)
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
    instagram: toInstagramSummary(credentials.metadata),
  }
}

export async function resolveWhatsAppIntegrationByPhoneNumberId(
  phoneNumberId: string,
): Promise<WhatsAppIntegrationCredentials | null> {
  const normalized = phoneNumberId.trim()
  if (normalized.length === 0) {
    return null
  }

  const row = await integrationsRepository.findConnectedWhatsAppByPhoneNumberId(normalized)
  if (row === null) {
    return null
  }

  return toWhatsAppIntegrationCredentials(row)
}

export async function resolveWhatsAppIntegrationByWabaId(
  wabaId: string,
): Promise<WhatsAppIntegrationCredentials | null> {
  const normalized = wabaId.trim()
  if (normalized.length === 0) {
    return null
  }

  const row = await integrationsRepository.findConnectedWhatsAppByWabaId(normalized)
  if (row === null) {
    return null
  }

  return toWhatsAppIntegrationCredentials(row)
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
    whatsapp: toWhatsAppSummary(credentials.metadata),
  }
}
