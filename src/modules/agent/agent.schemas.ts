import { z } from 'zod'

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

export const updateAgentSettingsBodySchema = z
  .object({
    enabled: z.boolean().optional(),
    confidenceThreshold: z.number().min(0.5).max(1).optional(),
    businessHoursEnabled: z.boolean().optional(),
    businessHoursTimezone: z.string().trim().min(1).max(80).optional(),
    businessHoursStart: z.string().regex(timePattern, 'Use HH:MM format').optional(),
    businessHoursEnd: z.string().regex(timePattern, 'Use HH:MM format').optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one setting must be provided',
  })

export type UpdateAgentSettingsBody = z.infer<typeof updateAgentSettingsBodySchema>
