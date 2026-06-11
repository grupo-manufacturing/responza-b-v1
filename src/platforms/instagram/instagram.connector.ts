import { parseGraphApiError, type GraphErrorBody } from '../shared/graphErrors.js'
import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import type { SendTextMessageResult } from '../types.js'

type InstagramMessagesResponse = {
  message_id?: string
  recipient_id?: string
}

function graphApiBaseUrl(): string {
  const { INSTAGRAM_GRAPH_VERSION } = loadEnv()
  return `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}`
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
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: { id: to },
        message: { text: content },
      }),
    })

    if (!response.ok) {
      const errorText = await parseGraphApiError(response, 'Instagram API request failed')

      try {
        const errorBody = (await response.clone().json()) as GraphErrorBody
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

  let response: Response
  try {
    response = await sendRequest()
  } catch (error) {
    if (error instanceof Error && error.message === 'TRANSIENT_ERROR') {
      await new Promise((resolve) => setTimeout(resolve, 1600))
      response = await sendRequest()
    } else {
      throw error
    }
  }

  const data = (await response.json()) as InstagramMessagesResponse
  const platformMessageId = data.message_id ?? null

  return {
    platformMessageId: typeof platformMessageId === 'string' ? platformMessageId : null,
  }
}
