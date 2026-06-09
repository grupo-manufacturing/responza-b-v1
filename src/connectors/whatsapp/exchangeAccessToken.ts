import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'

type GraphTokenResponse = {
  access_token?: string
}

type GraphErrorBody = {
  error?: {
    message?: string
  }
}

async function parseGraphError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as GraphErrorBody
    const message = body.error?.message
    if (typeof message === 'string' && message.length > 0) {
      return message
    }
  } catch {
    // ignore parse errors
  }

  return `Token exchange failed (${response.status})`
}

export async function exchangeWhatsAppAccessToken(code: string): Promise<string> {
  const { META_APP_ID, META_APP_SECRET, WHATSAPP_GRAPH_VERSION } = loadEnv()
  const trimmedCode = code.trim()

  if (trimmedCode.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'code is required')
  }

  if (META_APP_ID.length === 0 || META_APP_SECRET.length === 0) {
    throw new AppError(500, 'INTERNAL_ERROR', 'META_APP_ID and META_APP_SECRET are required on server')
  }

  const url = new URL(`https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}/oauth/access_token`)
  url.searchParams.set('client_id', META_APP_ID)
  url.searchParams.set('client_secret', META_APP_SECRET)
  url.searchParams.set('code', trimmedCode)

  const response = await fetch(url)

  if (!response.ok) {
    const message = await parseGraphError(response)
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const data = (await response.json()) as GraphTokenResponse
  const accessToken = data.access_token

  if (typeof accessToken !== 'string' || accessToken.trim().length === 0) {
    throw new AppError(502, 'INTERNAL_ERROR', 'Token exchange returned no access_token')
  }

  return accessToken.trim()
}
