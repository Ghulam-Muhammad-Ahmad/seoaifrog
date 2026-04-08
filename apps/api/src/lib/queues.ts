import '../env.js'
import { Queue } from 'bullmq'
import { createRedisConnection } from './redis.js'

const connection = createRedisConnection()

export const crawlQueue = new Queue<{ crawlSessionId: string }>('crawl', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
  },
})

export const auditQueue = new Queue<{ auditId: string }>('audit', {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 2000 },
  },
})
