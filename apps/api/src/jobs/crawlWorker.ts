import '../env.js'
import { PrismaClient, CrawlStatus } from '@prisma/client'
import { Worker } from 'bullmq'
import { createRedisConnection } from '../lib/redis.js'
import { runCrawlEngine } from '../crawler/CrawlEngine.js'

const prisma = new PrismaClient()
const workerConnection = createRedisConnection({ lazyConnect: false })
const publisher = createRedisConnection({ lazyConnect: false })

const worker = new Worker<{ crawlSessionId: string }>(
  'crawl',
  async (job) => {
    const { crawlSessionId } = job.data
    const session = await prisma.crawlSession.findUnique({ where: { id: crawlSessionId } })
    if (!session) return

    await prisma.crawlSession.update({
      where: { id: crawlSessionId },
      data: { status: CrawlStatus.RUNNING, startedAt: new Date(), errorMessage: null },
    })

    try {
      await runCrawlEngine({
        prisma,
        redis: publisher,
        crawlSessionId,
        configJson: session.config,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await prisma.crawlSession.update({
        where: { id: crawlSessionId },
        data: {
          status: CrawlStatus.FAILED,
          errorMessage: msg,
          completedAt: new Date(),
        },
      })
    }
  },
  { connection: workerConnection },
)

worker.on('failed', (job, err) => {
  console.error('crawl job failed', job?.id, err)
})

console.log('crawl worker listening')
