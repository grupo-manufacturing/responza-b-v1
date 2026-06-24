import { getSupabaseAdminClient } from '../database/index.js'
import { loadEnv } from '../config/index.js'
import { AppError } from '../errors/index.js'

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60

export function getMessageMediaBucketName(): string {
  const env = loadEnv()
  return env.SUPABASE_STORAGE_BUCKET
}

export async function uploadMessageMedia(input: {
  storagePath: string
  body: Buffer
  mimeType: string
}): Promise<void> {
  const client = getSupabaseAdminClient()
  const bucket = getMessageMediaBucketName()

  const { error } = await client.storage.from(bucket).upload(input.storagePath, input.body, {
    contentType: input.mimeType,
    upsert: false,
  })

  if (error !== null) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to store message media')
  }
}

export async function downloadMessageMedia(storagePath: string): Promise<Buffer> {
  const client = getSupabaseAdminClient()
  const bucket = getMessageMediaBucketName()

  const { data, error } = await client.storage.from(bucket).download(storagePath)

  if (error !== null || data === null) {
    throw new AppError(404, 'NOT_FOUND', 'Message media not found')
  }

  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

export async function messageMediaExists(storagePath: string): Promise<boolean> {
  const client = getSupabaseAdminClient()
  const bucket = getMessageMediaBucketName()
  const lastSlash = storagePath.lastIndexOf('/')
  const folder = lastSlash >= 0 ? storagePath.slice(0, lastSlash) : ''
  const filename = lastSlash >= 0 ? storagePath.slice(lastSlash + 1) : storagePath

  const { data, error } = await client.storage.from(bucket).list(folder, {
    search: filename,
    limit: 1,
  })

  if (error !== null) {
    return false
  }

  return (data ?? []).some((item) => item.name === filename)
}

export async function createMessageMediaSignedUrl(
  storagePath: string,
  options?: { download?: string | boolean },
): Promise<string> {
  const client = getSupabaseAdminClient()
  const bucket = getMessageMediaBucketName()

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS, {
      download: options?.download,
    })

  if (error !== null || data?.signedUrl === undefined) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create media URL')
  }

  return data.signedUrl
}
