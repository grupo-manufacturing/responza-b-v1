import { z } from 'zod'

import { INTEGRATION_PLATFORMS } from './integrations.constants.js'

export const integrationPlatformParamsSchema = z.object({
  platform: z.enum(INTEGRATION_PLATFORMS),
})

export const whatsappSessionInfoSchema = z
  .object({
    phone_number_id: z.string().min(1),
    waba_id: z.string().min(1),
    business_id: z.string().optional(),
  })
  .passthrough()

export const integrationConnectBodySchema = z.object({
  code: z.string().min(1).optional(),
  session_info: whatsappSessionInfoSchema.optional(),
})

export type IntegrationConnectBody = z.infer<typeof integrationConnectBodySchema>
