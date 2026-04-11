import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { auditQueue } from '../lib/queues.js'
import type { AuditDTO, SkillResultDTO } from '@seoaifrog/shared'
import {
  decodeAuditSelection,
  encodeAuditSelection,
  isUrlWithinProjectRoot,
  normalizeAuditSkills,
} from '../ai/auditSelection.js'

async function assertProject(fastify: { prisma: import('@prisma/client').PrismaClient }, userId: string, projectId: string) {
  return fastify.prisma.project.findFirst({
    where: { id: projectId, userId },
  })
}

function auditDto(a: {
  id: string
  projectId: string
  crawlSessionId: string | null
  status: string
  skillsSelected: string
  overallScore: number | null
  createdAt: Date
  completedAt: Date | null
  errorMessage: string | null
  skillResults?: {
    id: string
    skillName: string
    status: string
    score: number | null
    rawResponse: string | null
    durationMs: number | null
  }[]
}): AuditDTO {
  const selection = decodeAuditSelection(a.skillsSelected)
  const skillResults: SkillResultDTO[] = (a.skillResults ?? []).map((r) => ({
    id: r.id,
    skillName: r.skillName,
    status: r.status,
    score: r.score,
    preview: r.rawResponse?.slice(0, 200),
    rawResponse: r.rawResponse ?? undefined,
    durationMs: r.durationMs,
  }))
  return {
    id: a.id,
    projectId: a.projectId,
    crawlSessionId: a.crawlSessionId,
    status: a.status as AuditDTO['status'],
    skillsSelected: selection.skills,
    targetUrl: selection.targetUrl,
    overallScore: a.overallScore,
    skillResults,
    createdAt: a.createdAt.toISOString(),
    completedAt: a.completedAt?.toISOString() ?? null,
    errorMessage: a.errorMessage,
  }
}

const auditsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.post('/projects/:id/audits', async (request, reply) => {
    const { id: projectId } = request.params as { id: string }
    const project = await assertProject(fastify, request.user!.id, projectId)
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const parsed = z
      .object({
        crawlSessionId: z.string().min(1).nullable().optional(),
        targetUrl: z.string().url().nullable().optional(),
        skills: z.array(z.string().min(1)).min(1),
      })
      .safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const { crawlSessionId, targetUrl } = parsed.data
    const skills = normalizeAuditSkills(parsed.data.skills)
    const crawlId = crawlSessionId ?? null
    const selectedTargetUrl = targetUrl?.trim() ? targetUrl.trim() : null

    if (selectedTargetUrl && !isUrlWithinProjectRoot(selectedTargetUrl, project.rootUrl)) {
      return reply.status(400).send({ error: 'targetUrl must be within the project root domain' })
    }

    if (crawlId) {
      const crawl = await fastify.prisma.crawlSession.findFirst({
        where: { id: crawlId, projectId },
      })
      if (!crawl) return reply.status(400).send({ error: 'Invalid crawlSessionId' })
    }

    const userOpenAi = await fastify.prisma.user.findUnique({
      where: { id: request.user!.id },
      select: { openaiApiKeyEnc: true },
    })
    if (!userOpenAi?.openaiApiKeyEnc) {
      return reply.status(400).send({
        error: 'OpenAI API key is not configured. Save your key in Account Settings before starting an audit.',
        code: 'OPENAI_KEY_NOT_CONFIGURED',
      })
    }
    if (!process.env.ACCOUNT_ENCRYPTION_KEY?.trim()) {
      return reply.status(503).send({
        error: 'Server encryption is not configured. Set ACCOUNT_ENCRYPTION_KEY to enable saved OpenAI keys.',
        code: 'ENCRYPTION_NOT_CONFIGURED',
      })
    }

    const audit = await fastify.prisma.audit.create({
      data: {
        projectId,
        crawlSessionId: crawlId,
        skillsSelected: encodeAuditSelection({
          skills,
          targetUrl: selectedTargetUrl,
        }),
        skillResults: {
          create: skills.map((skillName) => ({
            skillName,
            status: 'pending',
          })),
        },
      },
    })
    // #region agent log
    fetch('http://127.0.0.1:7792/ingest/9420941f-ba7f-48e3-b6bf-dd47d9ba812b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b9cf3a'},body:JSON.stringify({sessionId:'b9cf3a',runId:'pending-audit-debug',hypothesisId:'H1',location:'routes/audits.ts:post-create',message:'audit row created before queue add',data:{auditId:audit.id,projectId,crawlSessionId:crawlId,skillsCount:skills.length,targetUrl:selectedTargetUrl},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    try {
      await auditQueue.add(
        'run',
        { auditId: audit.id },
        { jobId: audit.id, removeOnComplete: true, removeOnFail: false },
      )
      // #region agent log
      fetch('http://127.0.0.1:7792/ingest/9420941f-ba7f-48e3-b6bf-dd47d9ba812b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b9cf3a'},body:JSON.stringify({sessionId:'b9cf3a',runId:'pending-audit-debug',hypothesisId:'H1',location:'routes/audits.ts:post-enqueue',message:'audit queue add succeeded',data:{auditId:audit.id,queueName:'audit'},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7792/ingest/9420941f-ba7f-48e3-b6bf-dd47d9ba812b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b9cf3a'},body:JSON.stringify({sessionId:'b9cf3a',runId:'pending-audit-debug',hypothesisId:'H1',location:'routes/audits.ts:enqueue-error',message:'audit queue add failed',data:{auditId:audit.id,error:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      fastify.log.error({ err }, 'auditQueue.add failed (Redis / BullMQ)')
      try {
        await fastify.prisma.audit.delete({ where: { id: audit.id } })
      } catch (delErr) {
        fastify.log.error({ err: delErr }, 'failed to remove orphan audit after queue error')
      }
      return reply.status(503).send({
        error:
          'Could not enqueue the audit. Ensure Redis is running and REDIS_URL is correct (e.g. docker compose up -d redis).',
        code: 'QUEUE_UNAVAILABLE',
      })
    }

    const full = await fastify.prisma.audit.findUnique({
      where: { id: audit.id },
      include: { skillResults: true },
    })
    return auditDto(full!)
  })

  fastify.get('/projects/:id/audits', async (request, reply) => {
    const { id: projectId } = request.params as { id: string }
    const project = await assertProject(fastify, request.user!.id, projectId)
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const list = await fastify.prisma.audit.findMany({
      where: { projectId },
      include: { skillResults: true },
      orderBy: { createdAt: 'desc' },
    })
    return list.map((a) => auditDto(a))
  })

  fastify.get('/audits/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const audit = await fastify.prisma.audit.findFirst({
      where: { id, project: { userId: request.user!.id } },
      include: { skillResults: true },
    })
    if (!audit) return reply.status(404).send({ error: 'Not found' })
    return auditDto(audit)
  })

  fastify.get('/audits/:id/skills/:name', async (request, reply) => {
    const { id, name } = request.params as { id: string; name: string }
    const audit = await fastify.prisma.audit.findFirst({
      where: { id, project: { userId: request.user!.id } },
    })
    if (!audit) return reply.status(404).send({ error: 'Not found' })

    const skill = await fastify.prisma.skillResult.findFirst({
      where: { auditId: id, skillName: name },
    })
    if (!skill) return reply.status(404).send({ error: 'Skill result not found' })

    return {
      id: skill.id,
      skillName: skill.skillName,
      status: skill.status,
      score: skill.score,
      rawResponse: skill.rawResponse,
      parsedData: skill.parsedData,
      tokensUsed: skill.tokensUsed,
      durationMs: skill.durationMs,
      completedAt: skill.completedAt?.toISOString() ?? null,
    }
  })

  fastify.post('/audits/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string }
    const audit = await fastify.prisma.audit.findFirst({
      where: { id, project: { userId: request.user!.id } },
    })
    if (!audit) return reply.status(404).send({ error: 'Not found' })
    if (audit.status === 'COMPLETED' || audit.status === 'FAILED') {
      return reply.status(400).send({ error: 'Audit already finished' })
    }

    await fastify.prisma.audit.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage: 'Cancelled by user',
        completedAt: new Date(),
      },
    })

    const job = await auditQueue.getJob(id)
    try {
      await job?.remove()
    } catch {
      // job may already be active; status is already marked failed
    }

    const full = await fastify.prisma.audit.findUnique({
      where: { id },
      include: { skillResults: true },
    })
    return auditDto(full!)
  })
}

export default auditsRoutes
