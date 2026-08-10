import { z } from 'zod'

export const knowledgeJobParamsSchema = z.object({
  jobId: z.string().uuid(),
})

export const askBodySchema = z.object({
  question: z.string().trim().min(1).max(2000),
})

export type KnowledgeJobParams = z.infer<typeof knowledgeJobParamsSchema>
export type AskBody = z.infer<typeof askBodySchema>
