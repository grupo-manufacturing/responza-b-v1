import compression from 'compression'
import cors from 'cors'
import express, { type Express, type Request } from 'express'
import helmet from 'helmet'

import { getCorsOrigins, loadEnv } from '../shared/config/index.js'
import {
  errorHandler,
  notFoundHandler,
  requestTimeoutMiddleware,
  shutdownGuardMiddleware,
} from '../shared/middleware/index.js'
import { createAppRouter } from './router/index.js'

export function createApp(): Express {
  const env = loadEnv()
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY_HOPS)
  app.use(shutdownGuardMiddleware)
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  )
  app.use(
    compression({
      threshold: 1024,
    }),
  )
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
        const request = req as Request
        if (request.originalUrl.startsWith('/webhooks')) {
          request.rawBody = buf
        }
      },
    }),
  )
  app.use(requestTimeoutMiddleware)
  app.use(createAppRouter())
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
