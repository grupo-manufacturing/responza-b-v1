import { logger } from '../../shared/logger.js'
import { getInstagramCredentialsForOrganization } from '../../modules/integrations/credentials.service.js'
import type { ConversationListRecord, ParticipantRecord } from '../../modules/inbox/inbox.repository.js'
import * as inboxRepository from '../../modules/inbox/inbox.repository.js'
import {
  formatInstagramParticipantDisplayName,
  resolveInstagramParticipantProfile,
} from './resolveParticipantProfile.js'

function isInstagramPlaceholderDisplayName(displayName: string, platformUserId: string): boolean {
  const trimmed = displayName.trim()
  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed

  return withoutAt === platformUserId || /^\d{5,}$/.test(withoutAt)
}

function participantNeedsInstagramEnrichment(participant: ParticipantRecord): boolean {
  return (
    isInstagramPlaceholderDisplayName(participant.display_name, participant.platform_user_id) ||
    participant.avatar_url === null
  )
}

export async function resolveInstagramParticipantPresentation(input: {
  platformUserId: string
  accessToken: string
  fallbackDisplayName: string
}): Promise<{ displayName: string; avatarUrl: string | null }> {
  const profile = await resolveInstagramParticipantProfile({
    igsid: input.platformUserId,
    accessToken: input.accessToken,
  })

  if (profile === null) {
    return {
      displayName: input.fallbackDisplayName,
      avatarUrl: null,
    }
  }

  return {
    displayName: formatInstagramParticipantDisplayName(profile) ?? input.fallbackDisplayName,
    avatarUrl: profile.avatarUrl,
  }
}

export async function enrichInstagramParticipantRecord(input: {
  organizationId: string
  participant: ParticipantRecord
  accessToken: string
}): Promise<ParticipantRecord> {
  if (!participantNeedsInstagramEnrichment(input.participant)) {
    return input.participant
  }

  const presentation = await resolveInstagramParticipantPresentation({
    platformUserId: input.participant.platform_user_id,
    accessToken: input.accessToken,
    fallbackDisplayName: input.participant.display_name,
  })

  const shouldUpdate =
    presentation.displayName !== input.participant.display_name ||
    presentation.avatarUrl !== input.participant.avatar_url

  if (!shouldUpdate) {
    return input.participant
  }

  return inboxRepository.updateParticipantProfile({
    organization_id: input.organizationId,
    participant_id: input.participant.id,
    display_name: presentation.displayName,
    avatar_url: presentation.avatarUrl,
  })
}

export async function enrichInstagramConversationList(
  organizationId: string,
  conversations: ConversationListRecord[],
): Promise<ConversationListRecord[]> {
  const credentials = await getInstagramCredentialsForOrganization(organizationId)
  if (credentials === null) {
    return conversations
  }

  const enriched = [...conversations]

  await Promise.all(
    enriched.map(async (conversation, index) => {
      if (conversation.platform !== 'instagram') {
        return
      }

      const platformUserId =
        conversation.contact_platform_user_id ?? conversation.external_id.trim()
      if (platformUserId.length === 0) {
        return
      }

      const needsEnrichment =
        conversation.contact_display_name === null ||
        conversation.contact_avatar_url === null ||
        isInstagramPlaceholderDisplayName(
          conversation.contact_display_name ?? '',
          platformUserId,
        )

      if (!needsEnrichment) {
        return
      }

      try {
        const presentation = await resolveInstagramParticipantPresentation({
          platformUserId,
          accessToken: credentials.accessToken,
          fallbackDisplayName: conversation.contact_display_name ?? `@${platformUserId}`,
        })

        const shouldUpdate =
          presentation.displayName !== conversation.contact_display_name ||
          presentation.avatarUrl !== conversation.contact_avatar_url

        if (!shouldUpdate) {
          return
        }

        let participantId = conversation.contact_participant_id
        if (participantId === null) {
          const participant = await inboxRepository.findParticipant({
            organizationId,
            conversationId: conversation.id,
            platformUserId,
          })
          participantId = participant?.id ?? null
        }

        if (participantId !== null) {
          await inboxRepository.updateParticipantProfile({
            organization_id: organizationId,
            participant_id: participantId,
            display_name: presentation.displayName,
            avatar_url: presentation.avatarUrl,
          })
        }

        enriched[index] = {
          ...conversation,
          contact_display_name: presentation.displayName,
          contact_avatar_url: presentation.avatarUrl,
        }
      } catch (error) {
        logger.warn('[instagram] conversation profile enrichment failed', {
          conversationId: conversation.id,
          platformUserId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }),
  )

  return enriched
}

export async function backfillInstagramParticipantProfiles(organizationId: string): Promise<void> {
  const conversations = await inboxRepository.listConversations({
    organizationId,
    platform: 'instagram',
  })

  if (conversations.length === 0) {
    return
  }

  await enrichInstagramConversationList(organizationId, conversations)
}
