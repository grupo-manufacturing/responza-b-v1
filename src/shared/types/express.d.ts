import type { AuthContext } from '../auth/types.js'
import type { AdminSession } from '../admin/session.js'
import type { IntegrationPlatform } from '../../modules/integrations/integrations.constants.js'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
      admin?: AdminSession
      integrationPlatform?: IntegrationPlatform
      rawBody?: Buffer
    }
  }
}

export {}
