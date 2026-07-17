import { z } from 'zod'

export function normalizeAffiliateCode(value: string): string {
  return value.trim().toUpperCase()
}

const affiliateCodeSchema = z
  .string()
  .trim()
  .min(2, 'Referral code must be at least 2 characters')
  .max(32, 'Referral code must be 32 characters or less')
  .regex(/^[A-Za-z0-9_-]+$/, 'Referral code may only contain letters, numbers, hyphens, and underscores')
  .transform(normalizeAffiliateCode)

export const createAffiliateBodySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  code: affiliateCodeSchema,
  notes: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((value) => (value === undefined || value.length === 0 ? null : value)),
})

export const updateAffiliateBodySchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  notes: z
    .union([z.string().trim().max(2000), z.null()])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined
      if (value === null) return null
      return value.length === 0 ? null : value
    }),
  isActive: z.boolean().optional(),
})

export const affiliateIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export type CreateAffiliateBody = z.infer<typeof createAffiliateBodySchema>
export type UpdateAffiliateBody = z.infer<typeof updateAffiliateBodySchema>
