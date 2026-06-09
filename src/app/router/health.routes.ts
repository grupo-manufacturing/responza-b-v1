import { Router } from 'express'

import { checkDatabaseConnection } from '../../shared/database/index.js'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'responza-api',
  })
})

healthRouter.get('/health/ready', async (_req, res) => {
  const databaseReady = await checkDatabaseConnection()

  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ready' : 'not_ready',
    checks: {
      database: databaseReady ? 'ok' : 'fail',
    },
  })
})
