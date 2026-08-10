import type { KnowledgeQueueJobName, KnowledgeQueueJobData } from '../../../shared/queue/knowledge.queue.js'
import { KNOWLEDGE_JOB_NAMES } from '../../../shared/queue/knowledge.queue.js'
import { runIngestJob, runIndexJob } from './knowledge-job.service.js'

export async function processKnowledgeQueueJob(
  jobName: KnowledgeQueueJobName,
  data: KnowledgeQueueJobData,
): Promise<void> {
  if (jobName === KNOWLEDGE_JOB_NAMES.ingest) {
    await runIngestJob(data.jobId)
    return
  }

  if (jobName === KNOWLEDGE_JOB_NAMES.index) {
    await runIndexJob(data.jobId)
    return
  }

  throw new Error(`Unhandled knowledge job type: ${jobName}`)
}
