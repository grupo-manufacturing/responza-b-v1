import { z } from 'zod'

export const rewriteBodySchema = z.object({
  draft: z.string().trim().min(1).max(2000),
})

export type RewriteBody = z.infer<typeof rewriteBodySchema>
