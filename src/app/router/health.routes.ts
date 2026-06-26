import { Router } from 'express'

import { checkDatabaseConnection } from '../../shared/database/index.js'
import { checkRedisConnection } from '../../shared/redis/index.js'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'responza-api',
  })
})

healthRouter.get('/health/ready', async (_req, res) => {
  const [databaseReady, redisReady] = await Promise.all([
    checkDatabaseConnection(),
    checkRedisConnection(),
  ])
  const ready = databaseReady && redisReady

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: {
      database: databaseReady ? 'ok' : 'fail',
      redis: redisReady ? 'ok' : 'fail',
    },
  })
})
