import { z } from 'zod'

const optionalUrlField = z
  .union([z.string().trim().url({ message: 'Must be a valid URL' }), z.literal('')])
  .optional()
  .transform((value) => {
    if (value === undefined || value === '') {
      return null
    }

    return value
  })

export const completeBusinessBodySchema = z.object({
  brandName: z.string().trim().min(1).max(200),
  websiteUrl: optionalUrlField,
  facebookPageUrl: optionalUrlField,
  instagramPageUrl: optionalUrlField,
  businessDescription: z.string().trim().min(20).max(5000),
})

export const updateBusinessBodySchema = completeBusinessBodySchema

export const catalogueFileParamsSchema = z.object({
  fileId: z.string().uuid(),
})

export type CompleteBusinessBody = z.infer<typeof completeBusinessBodySchema>
export type UpdateBusinessBody = z.infer<typeof updateBusinessBodySchema>
