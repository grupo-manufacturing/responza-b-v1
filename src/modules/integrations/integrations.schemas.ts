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

export const connectIntegrationBodySchema = z.object({
  code: z.string().trim().min(1).optional(),
  session_info: whatsAppSessionInfoSchema.optional(),
})

export type ConnectIntegrationBody = z.infer<typeof connectIntegrationBodySchema>

export const whatsAppIntegrationMetadataSchema = z.object({
  phone_number_id: z.string().trim().min(1),
  waba_id: z.string().trim().min(1),
  business_id: z.string().trim().min(1).optional(),
})

export type WhatsAppIntegrationMetadataInput = z.infer<typeof whatsAppIntegrationMetadataSchema>

export const instagramIntegrationMetadataSchema = z.object({
  ig_user_id: z.string().trim().min(1),
  ig_username: z.string().trim().min(1),
  messaging_account_id: z.string().trim().min(1).optional(),
})

export type InstagramIntegrationMetadataInput = z.infer<typeof instagramIntegrationMetadataSchema>
