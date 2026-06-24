import { loadEnv } from '../../shared/config/index.js'
import { AppError } from '../../shared/errors/index.js'
import { parseGraphApiError } from '../shared/graphErrors.js'

type WhatsAppUploadMediaResponse = {
  id?: string
}

function graphApiBaseUrl(): string {
  const { WHATSAPP_GRAPH_VERSION } = loadEnv()
  return `https://graph.facebook.com/${WHATSAPP_GRAPH_VERSION}`
}

export async function uploadWhatsAppMedia(input: {
  phoneNumberId: string
  accessToken: string
  buffer: Buffer
  mimeType: string
  filename?: string | null
}): Promise<string> {
  const phoneNumberId = input.phoneNumberId.trim()
  const accessToken = input.accessToken.trim()
  const mimeType = input.mimeType.trim()

  if (phoneNumberId.length === 0 || accessToken.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'WhatsApp is not configured for sending')
  }

  if (input.buffer.byteLength === 0 || mimeType.length === 0) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Media file is required')
  }

  const formData = new FormData()
  formData.append('messaging_product', 'whatsapp')
  formData.append('type', mimeType)
  formData.append(
    'file',
    new Blob([input.buffer], { type: mimeType }),
    input.filename?.trim() || 'media',
  )

  const url = `${graphApiBaseUrl()}/${phoneNumberId}/media`
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  })

  if (!response.ok) {
    const message = await parseGraphApiError(response, 'WhatsApp media upload failed')
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const data = (await response.json()) as WhatsAppUploadMediaResponse
  const mediaId = data.id

  if (typeof mediaId !== 'string' || mediaId.length === 0) {
    throw new AppError(502, 'BAD_REQUEST', 'WhatsApp media upload did not return an id')
  }

  return mediaId
}
