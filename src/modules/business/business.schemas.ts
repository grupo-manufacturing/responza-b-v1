import { z } from 'zod'

const optionalHttpUrlField = z
  .union([
    z
      .string()
      .trim()
      .url({ message: 'Must be a valid http or https URL' })
      .refine((value) => value.startsWith('http://') || value.startsWith('https://'), {
        message: 'Must be a valid http or https URL',
      }),
    z.literal(''),
  ])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') {
      return null
    }

    return value
  })

export const completeBusinessBodySchema = z.object({
  brandName: z
    .string()
    .trim()
    .min(1, 'Brand name is required')
    .max(200, 'Brand name must be 200 characters or less'),
  websiteUrl: optionalHttpUrlField,
  facebookPageUrl: optionalHttpUrlField,
  instagramPageUrl: optionalHttpUrlField,
  businessDescription: z
    .string()
    .trim()
    .min(20, 'Business description must be at least 20 characters')
    .max(5000, 'Business description must be 5000 characters or less'),
})

export const updateBusinessBodySchema = completeBusinessBodySchema

export const catalogueFileParamsSchema = z.object({
  fileId: z.string().uuid(),
})

export type CompleteBusinessBody = z.infer<typeof completeBusinessBodySchema>
export type UpdateBusinessBody = z.infer<typeof updateBusinessBodySchema>
