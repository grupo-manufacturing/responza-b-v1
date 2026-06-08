import pino, { type Logger } from 'pino'

import { loadEnv } from '../config/index.js'

let loggerInstance: Logger | null = null

export function getLogger(): Logger {
  if (loggerInstance === null) {
    const env = loadEnv()
    loggerInstance = pino({
      level: env.LOG_LEVEL,
      base: {
        service: 'responza-api',
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    })
  }

  return loggerInstance
}

export type { Logger }
