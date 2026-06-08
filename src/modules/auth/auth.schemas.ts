import { z } from 'zod'

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(1).max(160),
})

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(128),
})

export type RegisterBody = z.infer<typeof registerBodySchema>
export type LoginBody = z.infer<typeof loginBodySchema>
