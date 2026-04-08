import '../env.js'
import { PrismaClient, AuditStatus } from '@prisma/client'
import { Worker } from 'bullmq'
import { createRedisConnection } from '../lib/redis.js'
import { runAuditOrchestrator } from '../ai/AuditOrchestrator.js'

const prisma = new PrismaClient()
const connection = createRedisConnection({ lazyConnect: false })
// #region agent log
fetch('http://127.0.0.1:7792/ingest/9420941f-ba7f-48e3-b6bf-dd47d9ba812b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b9cf3a'},body:JSON.stringify({sessionId:'b9cf3a',runId:'pending-audit-debug',hypothesisId:'H2',location:'jobs/auditWorker.ts:init',message:'audit worker module initialized',data:{queueName:'audit'},timestamp:Date.now()})}).catch(()=>{});
// #endregion

const worker = new Worker<{ auditId: string }>(
  'audit',
  async (job) => {
    const { auditId } = job.data
    // #region agent log
    fetch('http://127.0.0.1:7792/ingest/9420941f-ba7f-48e3-b6bf-dd47d9ba812b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b9cf3a'},body:JSON.stringify({sessionId:'b9cf3a',runId:'pending-audit-debug',hypothesisId:'H3',location:'jobs/auditWorker.ts:job-start',message:'audit worker received job',data:{auditId,jobId:job.id},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const audit = await prisma.audit.findUnique({ where: { id: auditId } })
    if (!audit) return

    await prisma.audit.update({
      where: { id: auditId },
      data: { status: AuditStatus.RUNNING, startedAt: new Date(), errorMessage: null },
    })

    try {
      // #region agent log
      fetch('http://127.0.0.1:7792/ingest/9420941f-ba7f-48e3-b6bf-dd47d9ba812b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b9cf3a'},body:JSON.stringify({sessionId:'b9cf3a',runId:'pending-audit-debug',hypothesisId:'H5',location:'jobs/auditWorker.ts:orchestrator-start',message:'starting audit orchestrator',data:{auditId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      await runAuditOrchestrator(prisma, auditId)
      // #region agent log
      fetch('http://127.0.0.1:7792/ingest/9420941f-ba7f-48e3-b6bf-dd47d9ba812b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b9cf3a'},body:JSON.stringify({sessionId:'b9cf3a',runId:'pending-audit-debug',hypothesisId:'H5',location:'jobs/auditWorker.ts:orchestrator-finish',message:'audit orchestrator finished',data:{auditId},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // #region agent log
      fetch('http://127.0.0.1:7792/ingest/9420941f-ba7f-48e3-b6bf-dd47d9ba812b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b9cf3a'},body:JSON.stringify({sessionId:'b9cf3a',runId:'pending-audit-debug',hypothesisId:'H5',location:'jobs/auditWorker.ts:orchestrator-error',message:'audit orchestrator threw error',data:{auditId,error:msg},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
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
  // #region agent log
  fetch('http://127.0.0.1:7792/ingest/9420941f-ba7f-48e3-b6bf-dd47d9ba812b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b9cf3a'},body:JSON.stringify({sessionId:'b9cf3a',runId:'pending-audit-debug',hypothesisId:'H3',location:'jobs/auditWorker.ts:worker-failed-event',message:'bullmq worker failed event',data:{jobId:job?.id,error:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  console.error('audit job failed', job?.id, err)
})

worker.on('error', (err) => {
  // #region agent log
  fetch('http://127.0.0.1:7792/ingest/9420941f-ba7f-48e3-b6bf-dd47d9ba812b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b9cf3a'},body:JSON.stringify({sessionId:'b9cf3a',runId:'pending-audit-debug',hypothesisId:'H2',location:'jobs/auditWorker.ts:worker-error-event',message:'bullmq worker error event',data:{error:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
})

console.log('audit worker listening')
