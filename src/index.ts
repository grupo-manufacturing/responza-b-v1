import type { Server } from 'node:http'

import { createApp } from './app/createApp.js'
import { loadEnv } from './shared/config/index.js'
import { logger } from './shared/logger.js'
import { closeRedisConnection, closeWebhookQueue } from './shared/queue/index.js'

const env = loadEnv()
const app = createApp()

let server: Server | null = null
let shuttingDown = false

server = app.listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT}`)
})

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    return
  }

  shuttingDown = true
  logger.info(`Shutting down API (${signal})`)

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
  await closeRedisConnection()
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
