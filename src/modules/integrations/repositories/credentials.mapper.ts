import { AppError } from '../../../shared/errors/index.js'
import type {
  IntegrationCredentials,
  GmailIntegrationMetadata,
  InstagramIntegrationMetadata,
  IntegrationPlatform,
  WhatsAppIntegrationMetadata,
} from '../integrations.constants.js'
import {
  normalizeIntegrationRecord,
  type IntegrationRecord,
} from './integration.repository.js'

export type IntegrationCredentialsRow = IntegrationRecord & {
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
  metadata: WhatsAppIntegrationMetadata | InstagramIntegrationMetadata | GmailIntegrationMetadata
}

export const INTEGRATION_CREDENTIAL_COLUMNS =
  'id, organization_id, platform, status, access_token, refresh_token, token_expires_at, metadata'

export function toIntegrationCredentials(row: IntegrationCredentialsRow): IntegrationCredentials {
  return {
    integrationId: row.id,
    organizationId: row.organization_id,
    accessToken: row.access_token,
    metadata: row.metadata,
  }
}

export function normalizeIntegrationCredentialsRow(
  row: Record<string, unknown>,
): IntegrationCredentialsRow {
  const rawMetadata = row.metadata
  if (rawMetadata === null || typeof rawMetadata !== 'object' || Array.isArray(rawMetadata)) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is invalid')
  }

  const metadata = rawMetadata as Record<string, unknown>
  const platform = row.platform as IntegrationPlatform

  const accessToken = row.access_token
  if (typeof accessToken !== 'string' || accessToken.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Integration access token is missing')
  }

  let normalizedMetadata: WhatsAppIntegrationMetadata | InstagramIntegrationMetadata | GmailIntegrationMetadata

  if (platform === 'whatsapp') {
    const phoneNumberId = metadata.phone_number_id
    const wabaId = metadata.waba_id
    if (typeof phoneNumberId !== 'string' || phoneNumberId.length === 0) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is missing phone_number_id')
    }
    if (typeof wabaId !== 'string' || wabaId.length === 0) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is missing waba_id')
    }

    const businessId = metadata['business_id']
    const verifiedName = metadata.verified_name
    const displayPhoneNumber = metadata.display_phone_number
    const profilePictureUrl = metadata.profile_picture_url
    normalizedMetadata = {
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      ...(typeof businessId === 'string' && businessId.length > 0
        ? { business_id: businessId }
        : {}),
      ...(typeof verifiedName === 'string' && verifiedName.length > 0
        ? { verified_name: verifiedName }
        : {}),
      ...(typeof displayPhoneNumber === 'string' && displayPhoneNumber.length > 0
        ? { display_phone_number: displayPhoneNumber }
        : {}),
      ...(typeof profilePictureUrl === 'string' && profilePictureUrl.length > 0
        ? { profile_picture_url: profilePictureUrl }
        : {}),
    }
  } else if (platform === 'instagram') {
    const businessAccountId = metadata.business_account_id
    const userId = metadata.user_id
    if (typeof businessAccountId !== 'string' || businessAccountId.length === 0) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is missing business_account_id')
    }
    if (typeof userId !== 'string' || userId.length === 0) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is missing user_id')
    }

    const username = metadata.username
    const profilePictureUrl = metadata.profile_picture_url
    normalizedMetadata = {
      business_account_id: businessAccountId,
      user_id: userId,
      ...(typeof username === 'string' && username.length > 0 ? { username } : {}),
      ...(typeof profilePictureUrl === 'string' && profilePictureUrl.length > 0
        ? { profile_picture_url: profilePictureUrl }
        : {}),
    }
  } else if (platform === 'gmail') {
    const email = metadata.email
    if (typeof email !== 'string' || email.length === 0) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Integration metadata is missing email')
    }

    const googleUserId = metadata.google_user_id
    const displayName = metadata.display_name
    const profilePictureUrl = metadata.profile_picture_url
    const scopes = metadata.scopes
    const historyId = metadata.history_id
    const watchExpiration = metadata.watch_expiration

    normalizedMetadata = {
      email,
      ...(typeof googleUserId === 'string' && googleUserId.length > 0
        ? { google_user_id: googleUserId }
        : {}),
      ...(typeof displayName === 'string' && displayName.length > 0
        ? { display_name: displayName }
        : {}),
      ...(typeof profilePictureUrl === 'string' && profilePictureUrl.length > 0
        ? { profile_picture_url: profilePictureUrl }
        : {}),
      ...(Array.isArray(scopes) && scopes.length > 0
        ? { scopes: scopes.filter((scope): scope is string => typeof scope === 'string') }
        : {}),
      ...(typeof historyId === 'string' && historyId.length > 0 ? { history_id: historyId } : {}),
      ...(typeof watchExpiration === 'string' && watchExpiration.length > 0
        ? { watch_expiration: watchExpiration }
        : {}),
    }
  } else {
    throw new AppError(
      500,
      'INTERNAL_ERROR',
      `Unsupported platform for credential normalization: ${platform}`,
    )
  }

  return {
    ...normalizeIntegrationRecord(row),
    access_token: accessToken,
    refresh_token: typeof row.refresh_token === 'string' ? row.refresh_token : null,
    token_expires_at: typeof row.token_expires_at === 'string' ? row.token_expires_at : null,
    metadata: normalizedMetadata,
  }
}

export function throwWhatsAppCredentialStoreError(error: { code?: string } | null): never {
  throwCredentialStoreError(
    error,
    'This WhatsApp phone number is already connected to another organization',
    'Failed to store WhatsApp credentials',
  )
}

export function throwInstagramCredentialStoreError(error: { code?: string } | null): never {
  throwCredentialStoreError(
    error,
    'This Instagram business account is already connected to another organization',
    'Failed to store Instagram credentials',
  )
}

export function throwGmailCredentialStoreError(error: { code?: string } | null): never {
  throwCredentialStoreError(
    error,
    'This Gmail account is already connected to another organization',
    'Failed to store Gmail credentials',
  )
}

function throwCredentialStoreError(
  error: { code?: string } | null,
  conflictMessage: string,
  internalMessage: string,
): never {
  if (error?.code === '23505') {
    throw new AppError(409, 'CONFLICT', conflictMessage)
  }

  throw new AppError(500, 'INTERNAL_ERROR', internalMessage)
}
