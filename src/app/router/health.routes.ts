import { Router } from 'express'

import { checkDatabaseConnection } from '../../shared/database/index.js'
import { checkRedisConnection } from '../../shared/redis/index.js'
import { isShuttingDown } from '../../shared/shutdown.js'

export const healthRouter = Router()

healthRouter.get('/health', (_req, res) => {
  if (isShuttingDown()) {
    res.status(503).json({
      status: 'shutting_down',
      service: 'responza-api',
    })
    return
  }

  res.status(200).json({
    status: 'ok',
    service: 'responza-api',
  })
})

healthRouter.get('/health/ready', async (_req, res) => {
  if (isShuttingDown()) {
    res.status(503).json({
      status: 'shutting_down',
      checks: {
        database: 'skipped',
        redis: 'skipped',
      },
    })
    return
  }

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
