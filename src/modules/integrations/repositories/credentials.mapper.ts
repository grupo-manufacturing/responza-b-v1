import { AppError } from '../../../shared/errors/index.js'
import type {
  IntegrationCredentials,
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
  metadata: WhatsAppIntegrationMetadata | InstagramIntegrationMetadata
}

export const INTEGRATION_CREDENTIAL_COLUMNS =
  'id, organization_id, platform, status, access_token, metadata'

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

  let normalizedMetadata: WhatsAppIntegrationMetadata | InstagramIntegrationMetadata

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
    normalizedMetadata = {
      phone_number_id: phoneNumberId,
      waba_id: wabaId,
      ...(typeof businessId === 'string' && businessId.length > 0
        ? { business_id: businessId }
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
    normalizedMetadata = {
      business_account_id: businessAccountId,
      user_id: userId,
      ...(typeof username === 'string' && username.length > 0 ? { username } : {}),
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
    metadata: normalizedMetadata,
  }
}

export function throwWhatsAppCredentialStoreError(error: { code?: string } | null): never {
  if (error?.code === '23505') {
    throw new AppError(
      409,
      'CONFLICT',
      'This WhatsApp phone number is already connected to another organization',
    )
  }

  throw new AppError(500, 'INTERNAL_ERROR', 'Failed to store WhatsApp credentials')
}

export function throwInstagramCredentialStoreError(error: { code?: string } | null): never {
  if (error?.code === '23505') {
    throw new AppError(
      409,
      'CONFLICT',
      'This Instagram business account is already connected to another organization',
    )
  }

  throw new AppError(500, 'INTERNAL_ERROR', 'Failed to store Instagram credentials')
}
