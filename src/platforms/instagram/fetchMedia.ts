import { AppError } from '../../shared/errors/index.js'
import { parseGraphApiError } from '../shared/graphErrors.js'

export async function fetchInstagramMediaBinary(input: {
  mediaUrl: string
  accessToken: string
}): Promise<{ buffer: Buffer; mimeType: string; fileSizeBytes: number }> {
  const mediaUrl = input.mediaUrl.trim()
  const accessToken = input.accessToken.trim()

  if (mediaUrl.length === 0 || accessToken.length === 0) {
    throw new AppError(400, 'BAD_REQUEST', 'Instagram media credentials are missing')
  }

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    const message = await parseGraphApiError(response, 'Failed to download Instagram media')
    throw new AppError(502, 'BAD_REQUEST', message)
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? 'application/octet-stream'
  const contentLengthHeader = response.headers.get('content-length')
  const contentLength =
    contentLengthHeader !== null && contentLengthHeader.length > 0
      ? Number.parseInt(contentLengthHeader, 10)
      : null

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const fileSizeBytes =
    contentLength !== null && !Number.isNaN(contentLength) && contentLength > 0
      ? contentLength
      : buffer.byteLength

  return {
    buffer,
    mimeType,
    fileSizeBytes,
  }
}
