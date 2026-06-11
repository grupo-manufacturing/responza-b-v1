import type { IntegrationCredentials } from './integrations.constants.js'
import * as integrationsRepository from './integrations.repository.js'
import { toIntegrationCredentials } from './integrations.repository.js'

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
