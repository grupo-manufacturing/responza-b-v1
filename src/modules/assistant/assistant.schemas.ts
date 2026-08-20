import { z } from 'zod'

import { ASSISTANT_QUESTION_MAX_LENGTH } from './assistant.constants.js'

export const assistantAskBodySchema = z.object({
  question: z.string().trim().min(1).max(ASSISTANT_QUESTION_MAX_LENGTH),
})

export type AssistantAskBody = z.infer<typeof assistantAskBodySchema>
