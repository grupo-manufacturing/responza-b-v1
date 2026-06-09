import type { AuthContext } from '../auth/types.js'
import type { IntegrationPlatform } from '../../modules/integrations/integrations.constants.js'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
      integrationPlatform?: IntegrationPlatform
      rawBody?: Buffer
    }
  }
}

export {}
