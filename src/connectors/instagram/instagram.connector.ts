import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { SendTextMessageResult } from '../types.js'

type GraphErrorBody = {
  error?: {
    message?: string
    code?: number
    type?: string
    is_transient?: boolean
  }
}

type InstagramSendResponse = {
  message_id?: string
}

type InstagramProfileResponse = {
  name?: string
  username?: string
}

export type InstagramParticipantProfile = {
  username: string
  name: string | null
}

function graphApiBaseUrl(): string {
  const { IG_GRAPH_VERSION } = loadEnv()
  return `https://graph.instagram.com/${IG_GRAPH_VERSION}`
}

async function parseGraphError(response: Response): Promise<{
  message: string
  graphErrorCode?: number
  isTransient?: boolean
}> {
  try {
    const body = (await response.json()) as GraphErrorBody
    const error = body.error
    const message = error?.message
    if (typeof message === 'string' && message.length > 0) {
      return {
        message,
        graphErrorCode: typeof error?.code === 'number' ? error.code : undefined,
        isTransient: error?.is_transient === true,
      }
    }
  } catch {
    // ignore parse errors
  }

  return {
    message: `Instagram API request failed (${response.status})`,
  }
}

function throwInstagramApiError(parsed: {
  message: string
  graphErrorCode?: number
  isTransient?: boolean
}): never {
  throw new AppError(502, 'BAD_REQUEST', parsed.message, {
    graphErrorCode: parsed.graphErrorCode,
    isTransient: parsed.isTransient,
  })
}

async function postInstagramMessage(input: {
  igAccountId: string
  to: string
  content: string
  accessToken: string
}): Promise<Response> {
  const url = `${graphApiBaseUrl()}/${input.igAccountId}/messages`

  return fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: { id: input.to },
      message: { text: input.content },
    }),
  })
}

export function isRetryableInstagramAccountError(error: unknown): boolean {
  if (!(error instanceof AppError)) {
    return false
  }

  const details = error.details
  if (typeof details !== 'object' || details === null || !('graphErrorCode' in details)) {
    return /Unsupported post request/i.test(error.message)
  }

  const graphErrorCode = details.graphErrorCode
  if (typeof graphErrorCode !== 'number') {
    return /Unsupported post request/i.test(error.message)
  }

  return graphErrorCode === 100 || graphErrorCode === 10
}

export async function sendInstagramTextMessage(input: {
  igAccountId: string
  to: string
  content: string
  accessToken: string
}): Promise<SendTextMessageResult> {
  const igAccountId = input.igAccountId.trim()
  const to = input.to.trim()
  const content = input.content.trim()
  const accessToken = input.accessToken.trim()

  if (to.length === 0 || content.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Recipient and message content are required')
  }

  if (igAccountId.length === 0 || accessToken.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'Instagram is not configured for sending')
  }

  let response = await postInstagramMessage({ igAccountId, to, content, accessToken })

  if (!response.ok) {
    const parsed = await parseGraphError(response)
    if (parsed.graphErrorCode === 2 && parsed.isTransient) {
      await new Promise((resolve) => setTimeout(resolve, 1600))
      response = await postInstagramMessage({ igAccountId, to, content, accessToken })
      if (!response.ok) {
        throwInstagramApiError(await parseGraphError(response))
      }
    } else {
      throwInstagramApiError(parsed)
    }
  }

  const data = (await response.json()) as InstagramSendResponse
  const platformMessageId = data.message_id ?? null

  return {
    platformMessageId: typeof platformMessageId === 'string' ? platformMessageId : null,
  }
}

export async function fetchInstagramParticipantProfile(
  igsid: string,
  accessToken: string,
): Promise<InstagramParticipantProfile | null> {
  const key = igsid.trim()
  const token = accessToken.trim()

  if (key.length === 0 || token.length === 0) {
    return null
  }

  const url = new URL(`${graphApiBaseUrl()}/${key}`)
  url.searchParams.set('fields', 'name,username')
  url.searchParams.set('access_token', token)

  try {
    const response = await fetch(url)

    if (!response.ok) {
      return null
    }

    const data = (await response.json()) as InstagramProfileResponse
    if (typeof data.username !== 'string' || data.username.trim().length === 0) {
      return null
    }

    return {
      username: data.username.trim(),
      name: typeof data.name === 'string' && data.name.trim().length > 0 ? data.name.trim() : null,
    }
  } catch {
    return null
  }
}

export const instagramConnector = {
  platform: 'instagram' as const,
  sendTextMessage: sendInstagramTextMessage,
  fetchParticipantProfile: fetchInstagramParticipantProfile,
}
