import type { AuthContext } from '../auth/types.js'

declare global {
  namespace Express {
    interface Request {
      correlationId: string
      auth?: AuthContext
      tenant?: {
        organizationId: string
      }
      rawBody?: string
    }
  }
}

export {}
