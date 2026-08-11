import { z } from 'zod'

export const askBodySchema = z.object({
  question: z.string().trim().min(1).max(2000),
})

export type AskBody = z.infer<typeof askBodySchema>
