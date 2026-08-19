import { z } from 'zod'

import { ADMIN_LIST_MAX_PAGE_SIZE, ADMIN_LIST_PAGE_SIZE } from './admin.constants.js'

export const adminPaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(ADMIN_LIST_MAX_PAGE_SIZE)
    .default(ADMIN_LIST_PAGE_SIZE),
})

export type AdminPaginationQuery = z.infer<typeof adminPaginationQuerySchema>
