import { z } from 'zod'

const apiLeadStatusSchema = z.enum([
  'new',
  'contacted',
  'qualified',
  'proposalSent',
  'won',
  'lost',
])

const apiLeadSourceSchema = z.enum(['manual', 'inbox', 'whatsapp', 'instagram', 'indiamart', 'other'])

const metadataSchema = z.record(z.unknown()).optional()

const emailSchema = z.string().trim().email().max(320).optional()
const phoneSchema = z.string().trim().min(3).max(32).optional()
const nameSchema = z.string().trim().min(1).max(200)
const notesSchema = z.string().trim().max(5000).optional()

export const listLeadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().trim().min(1).optional(),
  status: apiLeadStatusSchema.optional(),
})

export const leadIdParamsSchema = z.object({
  id: z.string().uuid(),
})

export const createLeadBodySchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  notes: notesSchema,
  source: apiLeadSourceSchema.default('manual'),
  status: apiLeadStatusSchema.default('new'),
  metadata: metadataSchema,
})

export const updateLeadBodySchema = z
  .object({
    name: nameSchema.optional(),
    email: z.union([emailSchema, z.literal('')]).optional(),
    phone: z.union([phoneSchema, z.literal('')]).optional(),
    notes: z.union([notesSchema, z.literal('')]).optional(),
    status: apiLeadStatusSchema.optional(),
    metadata: metadataSchema,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided',
  })

export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>
export type CreateLeadBody = z.infer<typeof createLeadBodySchema>
export type UpdateLeadBody = z.infer<typeof updateLeadBodySchema>

/** @internal — maps API status filter to DB enum */
export function dbStatusFromQueryStatus(
  status: z.infer<typeof apiLeadStatusSchema>,
): 'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost' {
  const map: Record<
    z.infer<typeof apiLeadStatusSchema>,
    'new' | 'contacted' | 'qualified' | 'proposal_sent' | 'won' | 'lost'
  > = {
    new: 'new',
    contacted: 'contacted',
    qualified: 'qualified',
    proposalSent: 'proposal_sent',
    won: 'won',
    lost: 'lost',
  }

  return map[status]
}
