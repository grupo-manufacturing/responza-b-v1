import cors from 'cors'
import express, { type Express, type Request } from 'express'
import helmet from 'helmet'

import { getCorsOrigins, loadEnv } from '../shared/config/index.js'
import {
  correlationIdMiddleware,
  createRateLimitMiddleware,
  errorHandler,
  notFoundHandler,
  requestLoggerMiddleware,
  tenantContextMiddleware,
} from '../shared/middleware/index.js'
import { createAppRouter } from './router/index.js'

export function createApp(): Express {
  const env = loadEnv()
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)

  app.use(correlationIdMiddleware)
  app.use(requestLoggerMiddleware)
  app.use(helmet())
  app.use(
    cors({
      origin: getCorsOrigins(env),
      credentials: true,
    }),
  )
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        ;(req as Request).rawBody = buf.toString('utf8')
      },
    }),
  )
  app.use(createRateLimitMiddleware())
  app.use(tenantContextMiddleware)
  app.use(createAppRouter())
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
