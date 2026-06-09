import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { SendTextMessageResult } from '../types.js'

type InstagramMessagesResponse = {
  message_id?: string
  recipient_id?: string
}

type InstagramErrorBody = {
  error?: {
    message?: string
    code?: number
    type?: string
    is_transient?: boolean
  }
}

function graphApiBaseUrl(): string {
  const { INSTAGRAM_GRAPH_VERSION } = loadEnv()
  return `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}`
}

async function parseInstagramError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as InstagramErrorBody
    const message = body.error?.message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  } catch {
    // ignore parse errors
  }

  return `Instagram API request failed (${response.status})`
}

export async function sendInstagramTextMessage(input: {
  to: string
  content: string
  businessAccountId: string
  accessToken: string
}): Promise<SendTextMessageResult> {
  const to = input.to.trim()
  const content = input.content.trim()
  const businessAccountId = input.businessAccountId.trim()
  const accessToken = input.accessToken.trim()

  if (to.length === 0 || content.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Recipient and message content are required')
  }

  if (businessAccountId.length === 0 || accessToken.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'Instagram is not configured for sending')
  }

  const url = `${graphApiBaseUrl()}/${businessAccountId}/messages`
  
  const sendRequest = async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        recipient: { id: to },
        message: { text: content }
      })
    })

    if (!response.ok) {
      const errorText = await parseInstagramError(response)
      
      // Check for transient errors that should be retried
      try {
        const errorBody = (await response.clone().json()) as InstagramErrorBody
        if (errorBody.error?.code === 2 && errorBody.error?.is_transient) {
          throw new Error('TRANSIENT_ERROR')
        }
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message === 'TRANSIENT_ERROR') {
          throw parseError
        }
      }

      throw new AppError(502, 'BAD_REQUEST', errorText)
    }

    return response
  }

  // Retry logic for transient errors
  let response: Response
  try {
    response = await sendRequest()
  } catch (error) {
    if (error instanceof Error && error.message === 'TRANSIENT_ERROR') {
      // Wait 1.6 seconds and retry once for transient errors
      await new Promise(resolve => setTimeout(resolve, 1600))
      response = await sendRequest()
    } else {
      throw error
    }
  }

  const data = (await response.json()) as InstagramMessagesResponse
  const platformMessageId = data.message_id ?? null

  return {
    platformMessageId: typeof platformMessageId === 'string' ? platformMessageId : null
  }
}

export const instagramConnector = {
  platform: 'instagram' as const,
  sendTextMessage: sendInstagramTextMessage,
}