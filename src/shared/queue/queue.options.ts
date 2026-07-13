import type { JobsOptions } from 'bullmq'

export function buildQueueJobOptions(input: {
  attempts: number
  backoffDelayMs: number
}): JobsOptions {
  return {
    attempts: input.attempts,
    backoff: {
      type: 'exponential',
      delay: input.backoffDelayMs,
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
  }
}

export function webhookDefaultJobOptions(): JobsOptions {
  return buildQueueJobOptions({
    attempts: 3,
    backoffDelayMs: 1000,
  })
}

export function mediaDefaultJobOptions(): JobsOptions {
  return buildQueueJobOptions({
    attempts: 3,
    backoffDelayMs: 1000,
  })
}

export function aiDefaultJobOptions(): JobsOptions {
  return buildQueueJobOptions({
    attempts: 2,
    backoffDelayMs: 2000,
  })
}
