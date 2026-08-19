export type AdminPaginationMeta = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function buildAdminPagination(page: number, limit: number, total: number): AdminPaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  }
}
