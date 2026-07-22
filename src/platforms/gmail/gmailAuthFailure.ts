import * as integrationsRepository from '../../modules/integrations/integrations.repository.js'
import { throwGmailRevokedError } from './gmailErrors.js'

export { GMAIL_NOT_CONNECTED_MESSAGE, GMAIL_REVOKED_MESSAGE } from './gmailErrors.js'

export async function disconnectGmailIntegration(organizationId: string): Promise<void> {
  await integrationsRepository.setIntegrationDisconnected(organizationId, 'gmail')
}

export async function disconnectGmailAndThrowRevoked(organizationId: string): Promise<never> {
  await disconnectGmailIntegration(organizationId)
  throwGmailRevokedError()
}
