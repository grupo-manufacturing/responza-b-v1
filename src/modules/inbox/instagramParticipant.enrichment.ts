import {
  formatInstagramParticipantDisplayName,
  resolveInstagramParticipantProfile,
} from '../../connectors/instagram/resolveParticipantProfile.js'
import { getInstagramCredentialsForOrganization } from '../integrations/integrations.service.js'
import type { ConversationListRecord, ParticipantRecord } from './inbox.repository.js'
import * as inboxRepository from './inbox.repository.js'

export function isInstagramPlaceholderDisplayName(
  displayName: string,
  platformUserId: string,
): boolean {
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

      if (
        conversation.contact_participant_id === null ||
        conversation.contact_platform_user_id === null
      ) {
        return
      }

      const needsEnrichment =
        conversation.contact_display_name === null ||
        conversation.contact_avatar_url === null ||
        isInstagramPlaceholderDisplayName(
          conversation.contact_display_name,
          conversation.contact_platform_user_id,
        )

      if (!needsEnrichment) {
        return
      }

      const presentation = await resolveInstagramParticipantPresentation({
        platformUserId: conversation.contact_platform_user_id,
        accessToken: credentials.accessToken,
        fallbackDisplayName:
          conversation.contact_display_name ?? conversation.contact_platform_user_id,
      })

      const shouldUpdate =
        presentation.displayName !== conversation.contact_display_name ||
        presentation.avatarUrl !== conversation.contact_avatar_url

      if (!shouldUpdate) {
        return
      }

      await inboxRepository.updateParticipantProfile({
        organization_id: organizationId,
        participant_id: conversation.contact_participant_id,
        display_name: presentation.displayName,
        avatar_url: presentation.avatarUrl,
      })

      enriched[index] = {
        ...conversation,
        contact_display_name: presentation.displayName,
        contact_avatar_url: presentation.avatarUrl,
      }
    }),
  )

  return enriched
}
