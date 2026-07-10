import { loadEnv } from '../../shared/config/index.js'
import { logger } from '../../shared/logger.js'
import {
  getKnowledgeQueue,
  KNOWLEDGE_JOB_NAMES,
} from '../../shared/queue/knowledge.queue.js'

export async function registerKnowledgeScheduler(): Promise<void> {
  const env = loadEnv()
  if (!env.KNOWLEDGE_SCHEDULER_ENABLED) {
    return
  }

  const queue = getKnowledgeQueue()

  await queue.add(
    KNOWLEDGE_JOB_NAMES.refreshInstagram,
    {},
    {
      repeat: {
        pattern: env.KNOWLEDGE_INSTAGRAM_REFRESH_CRON,
      },
      jobId: 'knowledge-repeat-instagram',
    },
  )

  await queue.add(
    KNOWLEDGE_JOB_NAMES.refreshWebsite,
    {},
    {
      repeat: {
        pattern: env.KNOWLEDGE_WEBSITE_REFRESH_CRON,
      },
      jobId: 'knowledge-repeat-website',
    },
  )

  logger.info(
    `Knowledge scheduler registered (instagram: ${env.KNOWLEDGE_INSTAGRAM_REFRESH_CRON}, website: ${env.KNOWLEDGE_WEBSITE_REFRESH_CRON})`,
  )
}
