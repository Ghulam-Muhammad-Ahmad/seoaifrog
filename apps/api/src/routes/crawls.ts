import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { CrawlStatus } from '@prisma/client'
import { defaultCrawlConfig, type CrawlConfig } from '@seoaifrog/shared'
import { crawlQueue } from '../lib/queues.js'
import type {
  CrawledPageDetailDTO,
  CrawledPageHeadingDTO,
  CrawledPageDTO,
  CrawledPageLinkDTO,
  IssueDTO,
} from '@seoaifrog/shared'

const optionalUrl = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().url().optional(),
)

const optionalPositiveInt = z.preprocess(
  (v) =>
    v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))
      ? undefined
      : v,
  z.number().int().positive().max(10_000).optional(),
)

const optionalNonNegInt = z.preprocess(
  (v) =>
    v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v))
      ? undefined
      : v,
  z.number().int().min(0).max(50).optional(),
)

const crawlConfigSchema = z
  .object({
    startUrl: optionalUrl,
    maxPages: optionalPositiveInt,
    maxDepth: optionalNonNegInt,
    concurrency: z.number().int().min(1).max(20).optional(),
    crawlDelay: z.number().int().min(0).optional(),
    userAgent: z.string().optional(),
    respectRobots: z.boolean().optional(),
    renderJs: z.boolean().optional(),
    jsWaitMs: z.number().int().optional(),
    followRedirects: z.boolean().optional(),
    includeNoindex: z.boolean().optional(),
    crawlFromSitemapOnly: z.boolean().optional(),
    sitemapUrl: optionalUrl,
    urlFilters: z
      .object({
        includePatterns: z.array(z.string()).optional(),
        excludePatterns: z.array(z.string()).optional(),
      })
      .optional(),
    maxFileSize: z.number().int().positive().optional(),
  })
  .optional()

function mergeCrawlConfig(body: z.infer<typeof crawlConfigSchema>, rootUrl: string): CrawlConfig {
  const base = { ...defaultCrawlConfig, startUrl: rootUrl }
  if (!body) return base
  const startFromBody =
    body.startUrl != null && String(body.startUrl).trim() !== '' ? String(body.startUrl).trim() : undefined
  const sitemapFromBody =
    body.sitemapUrl != null && String(body.sitemapUrl).trim() !== ''
      ? String(body.sitemapUrl).trim()
      : undefined
  return {
    ...base,
    ...body,
    startUrl: startFromBody ?? base.startUrl,
    sitemapUrl: sitemapFromBody ?? base.sitemapUrl,
    urlFilters: {
      includePatterns: body.urlFilters?.includePatterns ?? base.urlFilters.includePatterns,
      excludePatterns: body.urlFilters?.excludePatterns ?? base.urlFilters.excludePatterns,
    },
  }
}

function crawlSessionDto(s: {
  id: string
  projectId: string
  status: string
  config: string
  stats: string | null
  startedAt: Date | null
  completedAt: Date | null
  errorMessage: string | null
  createdAt: Date
}) {
  let config: unknown = {}
  let stats: unknown = null
  try {
    config = JSON.parse(s.config)
  } catch {
    /* keep */
  }
  if (s.stats) {
    try {
      stats = JSON.parse(s.stats)
    } catch {
      stats = s.stats
    }
  }
  return {
    id: s.id,
    projectId: s.projectId,
    status: s.status,
    config,
    stats,
    startedAt: s.startedAt?.toISOString() ?? null,
    completedAt: s.completedAt?.toISOString() ?? null,
    errorMessage: s.errorMessage,
    createdAt: s.createdAt.toISOString(),
  }
}

async function assertProject(fastify: { prisma: import('@prisma/client').PrismaClient }, userId: string, projectId: string) {
  return fastify.prisma.project.findFirst({
    where: { id: projectId, userId },
  })
}

async function assertCrawl(
  fastify: { prisma: import('@prisma/client').PrismaClient },
  userId: string,
  crawlId: string,
) {
  const crawl = await fastify.prisma.crawlSession.findFirst({
    where: { id: crawlId, project: { userId } },
    include: { project: true },
  })
  return crawl
}

const crawlsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.post('/projects/:id/crawls', async (request, reply) => {
    const { id: projectId } = request.params as { id: string }
    const project = await assertProject(fastify, request.user!.id, projectId)
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const parsed = z.object({ config: crawlConfigSchema }).safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const config = mergeCrawlConfig(parsed.data.config, project.rootUrl)
    const session = await fastify.prisma.crawlSession.create({
      data: {
        projectId,
        config: JSON.stringify(config),
      },
    })

    try {
      await crawlQueue.add(
        'run',
        { crawlSessionId: session.id },
        { jobId: session.id, removeOnComplete: true, removeOnFail: false },
      )
    } catch (err) {
      fastify.log.error({ err }, 'crawlQueue.add failed (Redis / BullMQ)')
      try {
        await fastify.prisma.crawlSession.delete({ where: { id: session.id } })
      } catch (delErr) {
        fastify.log.error({ err: delErr }, 'failed to remove orphan crawl session after queue error')
      }
      return reply.status(503).send({
        error:
          'Could not enqueue the crawl. Ensure Redis is running and REDIS_URL is correct (e.g. docker compose up -d redis).',
        code: 'QUEUE_UNAVAILABLE',
      })
    }

    return crawlSessionDto(session)
  })

  fastify.get('/projects/:id/crawls', async (request, reply) => {
    const { id: projectId } = request.params as { id: string }
    const project = await assertProject(fastify, request.user!.id, projectId)
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const list = await fastify.prisma.crawlSession.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })
    return list.map(crawlSessionDto)
  })

  fastify.get('/crawls/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const crawl = await assertCrawl(fastify, request.user!.id, id)
    if (!crawl) return reply.status(404).send({ error: 'Not found' })
    return crawlSessionDto(crawl)
  })

  fastify.delete('/crawls/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const crawl = await assertCrawl(fastify, request.user!.id, id)
    if (!crawl) return reply.status(404).send({ error: 'Not found' })

    await fastify.prisma.crawlSession.update({
      where: { id },
      data: { status: CrawlStatus.CANCELLED },
    })

    const job = await crawlQueue.getJob(id)
    try {
      await job?.remove()
    } catch {
      /* job may already be active or gone */
    }

    return reply.status(204).send()
  })

  fastify.post('/crawls/:id/pause', async (request, reply) => {
    const { id } = request.params as { id: string }
    const crawl = await assertCrawl(fastify, request.user!.id, id)
    if (!crawl) return reply.status(404).send({ error: 'Not found' })
    if (crawl.status !== CrawlStatus.RUNNING) {
      return reply.status(400).send({ error: 'Crawl is not running' })
    }
    const updated = await fastify.prisma.crawlSession.update({
      where: { id },
      data: { status: CrawlStatus.PAUSED },
    })
    return crawlSessionDto(updated)
  })

  fastify.post('/crawls/:id/resume', async (request, reply) => {
    const { id } = request.params as { id: string }
    const crawl = await assertCrawl(fastify, request.user!.id, id)
    if (!crawl) return reply.status(404).send({ error: 'Not found' })
    if (crawl.status !== CrawlStatus.PAUSED) {
      return reply.status(400).send({ error: 'Crawl is not paused' })
    }
    const updated = await fastify.prisma.crawlSession.update({
      where: { id },
      data: { status: CrawlStatus.RUNNING },
    })
    return crawlSessionDto(updated)
  })

  fastify.post('/crawls/:id/cancel', async (request, reply) => {
    const { id } = request.params as { id: string }
    const crawl = await assertCrawl(fastify, request.user!.id, id)
    if (!crawl) return reply.status(404).send({ error: 'Not found' })
    if (crawl.status === CrawlStatus.COMPLETED || crawl.status === CrawlStatus.CANCELLED || crawl.status === CrawlStatus.FAILED) {
      return reply.status(400).send({ error: 'Crawl already finished' })
    }
    const updated = await fastify.prisma.crawlSession.update({
      where: { id },
      data: { status: CrawlStatus.CANCELLED, completedAt: new Date() },
    })
    return crawlSessionDto(updated)
  })

  fastify.get('/crawls/:id/pages/:pageId', async (request, reply) => {
    const { id, pageId } = request.params as { id: string; pageId: string }
    const crawl = await assertCrawl(fastify, request.user!.id, id)
    if (!crawl) return reply.status(404).send({ error: 'Not found' })

    const p = await fastify.prisma.crawledPage.findFirst({
      where: { id: pageId, crawlSessionId: id },
      include: { issues: true },
    })
    if (!p) return reply.status(404).send({ error: 'Not found' })

    let links: CrawledPageLinkDTO[] = []
    if (p.linksJson) {
      try {
        const parsed = JSON.parse(p.linksJson) as unknown
        if (Array.isArray(parsed)) {
          links = parsed.filter(
            (x): x is CrawledPageLinkDTO =>
              typeof x === 'object' &&
              x !== null &&
              typeof (x as CrawledPageLinkDTO).href === 'string',
          )
        }
      } catch {
        /* keep links [] */
      }
    }

    let headings: CrawledPageHeadingDTO[] = []
    if (p.headingsJson) {
      try {
        const parsed = JSON.parse(p.headingsJson) as unknown
        if (Array.isArray(parsed)) {
          headings = parsed.filter(
            (x): x is CrawledPageHeadingDTO =>
              typeof x === 'object' &&
              x !== null &&
              typeof (x as CrawledPageHeadingDTO).level === 'number' &&
              typeof (x as CrawledPageHeadingDTO).text === 'string',
          )
        }
      } catch {
        /* keep headings [] */
      }
    }
    const h2Count = headings.filter((h) => h.level === 2).length

    const detail: CrawledPageDetailDTO = {
      id: p.id,
      url: p.url,
      statusCode: p.statusCode,
      contentType: p.contentType,
      indexable: p.indexable,
      crawlDepth: p.crawlDepth,
      responseTimeMs: p.responseTimeMs,
      htmlSize: p.htmlSize,
      title: p.title,
      titleLength: p.titleLength,
      metaDescription: p.metaDescription,
      metaDescLength: p.metaDescLength,
      h1Count: p.h1Count,
      h2Count,
      h1Text: p.h1Text,
      internalLinks: p.internalLinks,
      externalLinks: p.externalLinks,
      links,
      headings,
      wordCount: p.wordCount,
      crawledAt: p.crawledAt.toISOString(),
      hasSchema: p.hasSchema,
      schemaTypes: p.schemaTypes,
      schemaJson: p.schemaJson,
      issues: p.issues.map((i) => ({
        code: i.code,
        message: i.message,
        severity: i.severity,
        category: i.category,
        detail: i.detail,
      })),
    }

    return detail
  })

  fastify.get('/crawls/:id/pages', async (request, reply) => {
    const { id } = request.params as { id: string }
    const crawl = await assertCrawl(fastify, request.user!.id, id)
    if (!crawl) return reply.status(404).send({ error: 'Not found' })

    const q = request.query as Record<string, string | undefined>
    const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? '50', 10) || 50))
    const search = q.search?.trim()

    const where: import('@prisma/client').Prisma.CrawledPageWhereInput = { crawlSessionId: id }
    if (q.statusCode != null && q.statusCode !== '') {
      where.statusCode = parseInt(q.statusCode, 10)
    }
    if (q.indexable === 'true') where.indexable = true
    if (q.indexable === 'false') where.indexable = false
    if (q.hasSchema === 'true') where.hasSchema = true
    if (q.hasSchema === 'false') where.hasSchema = false
    if (search) {
      where.OR = [
        { url: { contains: search } },
        { title: { contains: search } },
      ]
    }
    if (q.hasIssues === 'true') {
      where.issues = { some: {} }
    }

    const [total, rows] = await Promise.all([
      fastify.prisma.crawledPage.count({ where }),
      fastify.prisma.crawledPage.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { crawledAt: 'asc' },
      }),
    ])

    const data: CrawledPageDTO[] = rows.map((p) => ({
      id: p.id,
      url: p.url,
      statusCode: p.statusCode,
      contentType: p.contentType,
      title: p.title,
      titleLength: p.titleLength,
      metaDescription: p.metaDescription,
      wordCount: p.wordCount,
      indexable: p.indexable,
      crawlDepth: p.crawlDepth,
      responseTimeMs: p.responseTimeMs,
      hasSchema: p.hasSchema,
    }))

    return { data, total, page, pageSize }
  })

  fastify.get('/crawls/:id/issues', async (request, reply) => {
    const { id } = request.params as { id: string }
    const crawl = await assertCrawl(fastify, request.user!.id, id)
    if (!crawl) return reply.status(404).send({ error: 'Not found' })

    const q = request.query as Record<string, string | undefined>
    const where: import('@prisma/client').Prisma.PageIssueWhereInput = {
      page: { crawlSessionId: id },
    }
    if (q.category) where.category = q.category as import('@prisma/client').IssueCategory
    if (q.severity) where.severity = q.severity as import('@prisma/client').IssueSeverity

    const issues = await fastify.prisma.pageIssue.findMany({
      where,
      include: { page: { select: { url: true } } },
      orderBy: [{ severity: 'asc' }, { category: 'asc' }],
    })

    const totals = { critical: 0, warning: 0, info: 0 }
    for (const i of issues) {
      if (i.severity === 'CRITICAL') totals.critical++
      else if (i.severity === 'WARNING') totals.warning++
      else totals.info++
    }

    const data: IssueDTO[] = issues.map((i) => ({
      id: i.id,
      pageId: i.pageId,
      category: i.category,
      severity: i.severity,
      code: i.code,
      message: i.message,
      detail: i.detail,
      pageUrl: i.page.url,
    }))

    return { data, totals }
  })
}

export default crawlsRoutes
