import { z } from 'zod'

const integrationPlatformSchema = z.enum(['whatsapp', 'instagram', 'indiamart'])

export const integrationPlatformParamsSchema = z.object({
  platform: integrationPlatformSchema,
})

export const connectIntegrationBodySchema = z
  .object({
    code: z.string().trim().min(1).optional(),
    session_info: z
      .object({
        phone_number_id: z.string().trim().min(1).optional(),
        waba_id: z.string().trim().min(1).optional(),
        business_id: z.string().trim().min(1).optional(),
      })
      .optional(),
  })
  .passthrough()

export type ConnectIntegrationBody = z.infer<typeof connectIntegrationBodySchema>
