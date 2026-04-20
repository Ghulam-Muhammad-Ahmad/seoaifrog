import '../env.js'
import { PrismaClient, AuditStatus } from '@prisma/client'
import { Worker } from 'bullmq'
import { createRedisConnection } from '../lib/redis.js'
import { runAuditOrchestrator } from '../ai/AuditOrchestrator.js'

const prisma = new PrismaClient()
const connection = createRedisConnection({ lazyConnect: false })

const worker = new Worker<{ auditId: string }>(
  'audit',
  async (job) => {
    const { auditId } = job.data
    const audit = await prisma.audit.findUnique({ where: { id: auditId } })
    if (!audit) return

    await prisma.audit.update({
      where: { id: auditId },
      data: { status: AuditStatus.RUNNING, startedAt: new Date(), errorMessage: null },
    })

    try {
      await runAuditOrchestrator(prisma, auditId)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await prisma.audit.update({
        where: { id: auditId },
        data: {
          status: AuditStatus.FAILED,
          errorMessage: msg,
          completedAt: new Date(),
        },
      })
    }
  },
  { connection },
)

worker.on('failed', (job, err) => {
  console.error('audit job failed', job?.id, err)
})

worker.on('error', (err) => {
  console.error('audit worker error', err)
})

console.log('audit worker listening')
