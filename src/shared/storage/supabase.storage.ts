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

export async function createMessageMediaSignedUrl(storagePath: string): Promise<string> {
  const client = getSupabaseAdminClient()
  const bucket = getMessageMediaBucketName()

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS)

  if (error !== null || data?.signedUrl === undefined) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create media URL')
  }

  return data.signedUrl
}
