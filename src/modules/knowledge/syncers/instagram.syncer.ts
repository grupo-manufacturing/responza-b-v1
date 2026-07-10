import { loadEnv } from '../../../shared/config/index.js'
import { logger } from '../../../shared/logger.js'
import type { IntegrationCredentials } from '../../integrations/integrations.constants.js'
import { instagramIntegrationMetadataSchema } from '../../integrations/integrations.schemas.js'
import { INSTAGRAM_PROFILE_SOURCE_KEY } from '../knowledge.constants.js'

export type InstagramKnowledgeDocument = {
  sourceKey: string
  text: string
  metadata: Record<string, unknown>
}

type InstagramProfileResponse = {
  biography?: string
  name?: string
  username?: string
  website?: string
  error?: {
    message?: string
  }
}

type InstagramMediaItem = {
  id?: string
  caption?: string
  permalink?: string
  timestamp?: string
}

type InstagramMediaResponse = {
  data?: InstagramMediaItem[]
  error?: {
    message?: string
  }
}

async function fetchInstagramJson<T>(url: URL, accessToken: string): Promise<T | null> {
  const env = loadEnv()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), env.KNOWLEDGE_INSTAGRAM_FETCH_TIMEOUT_MS)

  try {
    url.searchParams.set('access_token', accessToken)
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      logger.warn('[knowledge] Instagram API request failed', {
        status: response.status,
        body: body.slice(0, 300),
      })
      return null
    }

    return (await response.json()) as T
  } catch (error: unknown) {
    logger.warn('[knowledge] Instagram API request error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function syncInstagramKnowledge(
  credentials: IntegrationCredentials,
): Promise<InstagramKnowledgeDocument[]> {
  const metadata = instagramIntegrationMetadataSchema.parse(credentials.metadata)
  const { INSTAGRAM_GRAPH_VERSION, KNOWLEDGE_INSTAGRAM_MEDIA_LIMIT } = loadEnv()
  const documents: InstagramKnowledgeDocument[] = []

  const profileUrl = new URL(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${metadata.business_account_id}`,
  )
  profileUrl.searchParams.set('fields', 'biography,name,username,website')

  const profile = await fetchInstagramJson<InstagramProfileResponse>(profileUrl, credentials.accessToken)
  if (profile !== null && profile.error === undefined) {
    const profileLines = [
      profile.username !== undefined && profile.username.trim().length > 0
        ? `Username: @${profile.username.trim()}`
        : null,
      profile.name !== undefined && profile.name.trim().length > 0
        ? `Name: ${profile.name.trim()}`
        : null,
      profile.biography !== undefined && profile.biography.trim().length > 0
        ? `Bio: ${profile.biography.trim()}`
        : null,
      profile.website !== undefined && profile.website.trim().length > 0
        ? `Website: ${profile.website.trim()}`
        : null,
    ].filter((line): line is string => line !== null)

    if (profileLines.length > 0) {
      documents.push({
        sourceKey: INSTAGRAM_PROFILE_SOURCE_KEY,
        text: profileLines.join('\n'),
        metadata: {
          label: 'instagram:profile',
          username: profile.username ?? metadata.username ?? null,
        },
      })
    }
  }

  const mediaUrl = new URL(
    `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${metadata.business_account_id}/media`,
  )
  mediaUrl.searchParams.set('fields', 'id,caption,permalink,timestamp')
  mediaUrl.searchParams.set('limit', String(KNOWLEDGE_INSTAGRAM_MEDIA_LIMIT))

  const media = await fetchInstagramJson<InstagramMediaResponse>(mediaUrl, credentials.accessToken)
  if (media !== null && media.error === undefined) {
    for (const item of media.data ?? []) {
      const caption = item.caption?.trim() ?? ''
      if (caption.length === 0 || item.id === undefined) {
        continue
      }

      documents.push({
        sourceKey: `media:${item.id}`,
        text: caption,
        metadata: {
          label: 'instagram:post',
          permalink: item.permalink ?? null,
          timestamp: item.timestamp ?? null,
        },
      })
    }
  }

  logger.warn(
    `[knowledge] Instagram sync completed businessAccountId=${metadata.business_account_id} documents=${documents.length}`,
  )

  return documents
}
