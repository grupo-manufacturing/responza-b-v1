import { z } from 'zod'

const integrationPlatformSchema = z.enum(['whatsapp', 'instagram', 'indiamart'])

export const integrationPlatformParamsSchema = z.object({
  platform: integrationPlatformSchema,
})

export const whatsAppSessionInfoSchema = z.object({
  phone_number_id: z.string().trim().min(1),
  waba_id: z.string().trim().min(1),
  business_id: z.string().trim().min(1).optional(),
})

export const instagramSessionInfoSchema = z.object({
  business_account_id: z.string().trim().min(1),
  user_id: z.string().trim().min(1),
  username: z.string().trim().min(1).optional(),
})

export const connectIntegrationBodySchema = z.object({
  code: z.string().trim().min(1).optional(),
  redirect_uri: z.string().trim().min(1).optional(),
  session_info: z.union([
    whatsAppSessionInfoSchema,
    instagramSessionInfoSchema
  ]).optional(),
})

export type ConnectIntegrationBody = z.infer<typeof connectIntegrationBodySchema>

export const whatsAppIntegrationMetadataSchema = z.object({
  phone_number_id: z.string().trim().min(1),
  waba_id: z.string().trim().min(1),
  business_id: z.string().trim().min(1).optional(),
  verified_name: z.string().trim().min(1).optional(),
  display_phone_number: z.string().trim().min(1).optional(),
  profile_picture_url: z.string().trim().url().optional(),
})

export const instagramIntegrationMetadataSchema = z.object({
  business_account_id: z.string().trim().min(1),
  user_id: z.string().trim().min(1),
  username: z.string().trim().min(1).optional(),
  profile_picture_url: z.string().trim().url().optional(),
})
