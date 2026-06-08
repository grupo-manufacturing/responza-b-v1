import 'dotenv/config'

import { createApp } from './app/createApp.js'
import { closeRedisConnection } from './shared/cache/index.js'
import { loadEnv } from './shared/config/index.js'
import { getLogger } from './shared/logger/index.js'

async function startServer(): Promise<void> {
  const env = loadEnv()
  const app = createApp()

  const server = app.listen(env.PORT, () => {
    getLogger().info({ port: env.PORT, nodeEnv: env.NODE_ENV }, 'API server started')
  })

  const shutdown = async (signal: string) => {
    getLogger().info({ signal }, 'Shutting down API server')

    server.close(async () => {
      await closeRedisConnection()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })

  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
}

startServer().catch((error: unknown) => {
  getLogger().fatal({ err: error }, 'Failed to start API server')
  process.exit(1)
})
