import type { IncomingMessage, OutboundMessage, ParticipantProfile } from './types.js'

/**
 * Platform connector contract. Implemented per channel in Phase 5+ (WhatsApp, Instagram, etc.).
 * Inbox and integrations modules must not depend on platform-specific implementations.
 */
export interface IConnector {
  /** Validates stored credentials against the platform API. */
  validateCredentials(credentials: unknown): Promise<boolean>

  /** Verifies an incoming webhook signature before processing. */
  verifyWebhookSignature(signature: string, body: string): boolean

  /** Maps a platform webhook payload to the internal message model. */
  parseIncomingMessage(payload: unknown): Promise<IncomingMessage>

  /** Sends an outbound message via the platform API. */
  sendMessage(message: OutboundMessage): Promise<{ platformMessageId: string }>

  /** Fetches participant profile details from the platform. */
  fetchProfile(participantId: string): Promise<ParticipantProfile>

  /** Downloads media from the platform for storage. */
  fetchMedia(mediaUrl: string): Promise<Buffer>
}
