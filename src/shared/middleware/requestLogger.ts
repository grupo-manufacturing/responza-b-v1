import type { Request, Response } from 'express'
import { pinoHttp } from 'pino-http'

import { getLogger } from '../logger/index.js'

export const requestLoggerMiddleware = pinoHttp({
  logger: getLogger(),
  genReqId: (req: Request) => req.correlationId,
  customProps: (req: Request) => ({
    correlationId: req.correlationId,
    organizationId: req.tenant?.organizationId ?? null,
  }),
  customLogLevel: (_req: Request, res: Response, err?: Error) => {
    if (err !== undefined || res.statusCode >= 500) {
      return 'error'
    }

    if (res.statusCode >= 400) {
      return 'warn'
    }

    return 'info'
  },
})
