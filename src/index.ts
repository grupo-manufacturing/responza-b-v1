import { createApp } from './app/createApp.js'
import { loadEnv } from './shared/config/index.js'
import { logger } from './shared/logger.js'

const env = loadEnv()
const app = createApp()

app.listen(env.PORT, () => {
  logger.info(`API listening on port ${env.PORT}`)
})
