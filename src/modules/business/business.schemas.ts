import { z } from 'zod'

const WEBSITE_URL_MESSAGE =
  'Enter a full website link starting with https:// (e.g. https://yourshop.com)'
const INSTAGRAM_URL_MESSAGE =
  'Enter a full Instagram link starting with https:// (e.g. https://instagram.com/yourpage)'

function optionalHttpUrlField(message: string) {
  return z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === '') {
        return null
      }

      return value
    },
    z.union([
      z
        .string()
        .trim()
        .url({ message })
        .refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
          message,
        }),
      z.null(),
    ]),
  )
}

const businessProfileBodySchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1, 'Enter your brand name')
    .max(200, 'Brand name must be 200 characters or less'),
  websiteUrl: optionalHttpUrlField(WEBSITE_URL_MESSAGE),
  instagramPageUrl: optionalHttpUrlField(INSTAGRAM_URL_MESSAGE),
  businessDescription: z
    .string()
    .trim()
    .min(20, 'Tell us a bit more — at least 20 characters')
    .max(5000, 'Business description must be 5000 characters or less'),
})

const optionalReferralCodeField = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === '') {
      return null
    }

    return value
  },
  z.union([
    z
      .string()
      .trim()
      .min(2, 'Referral code must be at least 2 characters')
      .max(32, 'Referral code must be 32 characters or less')
      .regex(/^[A-Za-z0-9_-]+$/, 'Use only letters, numbers, hyphens, and underscores'),
    z.null(),
  ]),
)

export const completeBusinessBodySchema = businessProfileBodySchema.extend({
  referralCode: optionalReferralCodeField.optional(),
})

export const updateBusinessBodySchema = businessProfileBodySchema

export const catalogueFileParamsSchema = z.object({
  fileId: z.string().uuid(),
})

export type CompleteBusinessBody = z.infer<typeof completeBusinessBodySchema>
export type UpdateBusinessBody = z.infer<typeof updateBusinessBodySchema>
