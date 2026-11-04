import { Router } from 'express'

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

healthRouter.get('/health/ready', (_req, res) => {
  if (isShuttingDown()) {
    res.status(503).json({ status: 'shutting_down' })
    return
  }

  res.status(200).json({ status: 'ready' })
})
