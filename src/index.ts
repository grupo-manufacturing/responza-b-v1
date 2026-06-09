import { createApp } from './app/createApp.js'
import { loadEnv } from './shared/config/index.js'

const env = loadEnv()
const app = createApp()

app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`)
})
