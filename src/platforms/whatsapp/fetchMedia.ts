import { AppError } from '../../shared/errors/index.js'
import { parseGraphApiError } from '../shared/graphErrors.js'
import { whatsAppGraphApiBaseUrl } from './graphApi.js'

type WhatsAppMediaMetadataResponse = {
  url?: string
  mime_type?: string
  file_size?: number
}

export async function fetchWhatsAppMediaBinary(input: {
  mediaId: string
  accessToken: string
}): Promise<{ buffer: Buffer; mimeType: string; fileSizeBytes: number }> {
  const mediaId = input.mediaId.trim()
  const accessToken = input.accessToken.trim()

  if (mediaId.length === 0 || accessToken.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'WhatsApp media credentials are missing')
  }

  const metadataUrl = `${whatsAppGraphApiBaseUrl()}/${mediaId}`
  const metadataResponse = await fetch(metadataUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!metadataResponse.ok) {
    const message = await parseGraphApiError(metadataResponse, 'Failed to load WhatsApp media metadata')
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const metadata = (await metadataResponse.json()) as WhatsAppMediaMetadataResponse
  const downloadUrl = metadata.url
  const mimeType = metadata.mime_type?.trim() ?? 'application/octet-stream'

  if (downloadUrl === undefined || downloadUrl.length === 0) {
    throw new AppError(502, 'BAD_REQUEST', 'WhatsApp media URL is missing')
  }

  const downloadResponse = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!downloadResponse.ok) {
    const message = await parseGraphApiError(downloadResponse, 'Failed to download WhatsApp media')
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const arrayBuffer = await downloadResponse.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const fileSizeBytes =
    typeof metadata.file_size === 'number' && metadata.file_size > 0
      ? metadata.file_size
      : buffer.byteLength

  return {
    buffer,
    mimeType,
    fileSizeBytes,
  }
}
