import type { Server } from 'node:http'

import { createApp } from './app/createApp.js'
import { loadEnv } from './shared/config/index.js'
import { logger } from './shared/logger.js'
import { closeRedisConnection } from './shared/redis/index.js'
import {
  closeAgentQueue,
  closeAiQueue,
  closeMediaQueue,
  closeWebhookQueue,
} from './shared/queue/index.js'
import { beginShutdown } from './shared/shutdown.js'

const env = loadEnv()
const app = createApp()

let server: Server | null = null
let shutdownStarted = false

server = app.listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT}`)
})

async function shutdown(signal: string): Promise<void> {
  if (shutdownStarted) {
    return
  }

  shutdownStarted = true
  beginShutdown()
  logger.info(`Shutting down API (${signal})`)

  const forceExitTimer = setTimeout(() => {
    logger.warn(`API shutdown grace period exceeded (${env.SHUTDOWN_GRACE_MS}ms)`)
    process.exit(1)
  }, env.SHUTDOWN_GRACE_MS)
  forceExitTimer.unref()

  if (server !== null) {
    await new Promise<void>((resolve, reject) => {
      server!.close((error) => {
        if (error !== undefined) {
          reject(error)
          return
        }

        resolve()
      })
    })
    server = null
  }

  await closeWebhookQueue()
  await closeMediaQueue()
  await closeAiQueue()
  await closeAgentQueue()
  await closeRedisConnection()

  clearTimeout(forceExitTimer)
}

function handleShutdownSignal(signal: string): void {
  void shutdown(signal)
    .then(() => {
      process.exit(0)
    })
    .catch((error: unknown) => {
      logger.error(error)
      process.exit(1)
    })
}

process.on('SIGINT', () => {
  handleShutdownSignal('SIGINT')
})

process.on('SIGTERM', () => {
  handleShutdownSignal('SIGTERM')
})
