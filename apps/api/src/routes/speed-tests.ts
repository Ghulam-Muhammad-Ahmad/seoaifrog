import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { decryptUserSecret } from '../lib/accountCrypto.js'
import { runPageSpeed, type PageSpeedStrategy } from '../lib/pagespeed.js'

const runSpeedTestBody = z.object({
  url: z.string().url(),
  strategy: z.enum(['mobile', 'desktop']).default('mobile'),
})

function speedTestDto(t: {
  id: string
  projectId: string
  createdByUserId: string
  url: string
  strategy: string
  fetchedAt: Date
  performanceScore: number | null
  accessibilityScore: number | null
  bestPracticesScore: number | null
  seoScore: number | null
  pwaScore: number | null
  firstContentfulPaintMs: number | null
  largestContentfulPaintMs: number | null
  cumulativeLayoutShift: number | null
  interactionToNextPaintMs: number | null
  totalBlockingTimeMs: number | null
  speedIndexMs: number | null
  rawJson: unknown
  createdAt: Date
}) {
  return {
    id: t.id,
    projectId: t.projectId,
    createdByUserId: t.createdByUserId,
    url: t.url,
    strategy: t.strategy as PageSpeedStrategy,
    fetchedAt: t.fetchedAt.toISOString(),
    performanceScore: t.performanceScore,
    accessibilityScore: t.accessibilityScore,
    bestPracticesScore: t.bestPracticesScore,
    seoScore: t.seoScore,
    pwaScore: t.pwaScore,
    firstContentfulPaintMs: t.firstContentfulPaintMs,
    largestContentfulPaintMs: t.largestContentfulPaintMs,
    cumulativeLayoutShift: t.cumulativeLayoutShift,
    interactionToNextPaintMs: t.interactionToNextPaintMs,
    totalBlockingTimeMs: t.totalBlockingTimeMs,
    speedIndexMs: t.speedIndexMs,
    rawJson: t.rawJson,
    createdAt: t.createdAt.toISOString(),
  }
}

const speedTestsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  function getMasterKey() {
    return process.env.ACCOUNT_ENCRYPTION_KEY?.trim() ?? ''
  }

  fastify.post('/projects/:id/speed-tests', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = runSpeedTestBody.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const project = await fastify.prisma.project.findFirst({
      where: { id, userId: request.user!.id },
      select: { id: true, rootUrl: true },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const userKeys = await fastify.prisma.user.findUnique({
      where: { id: request.user!.id },
      select: { pagespeedApiKeyEnc: true },
    })
    const master = getMasterKey()
    if (!master) {
      return reply.status(503).send({ error: 'Server encryption is not configured' })
    }
    let apiKey: string | undefined
    if (userKeys?.pagespeedApiKeyEnc) {
      try {
        apiKey = decryptUserSecret(userKeys.pagespeedApiKeyEnc, master)
      } catch (e: unknown) {
        fastify.log.error({ err: e }, 'decrypt pagespeed key for speed test')
        return reply.status(500).send({ error: 'Could not read saved PageSpeed API key' })
      }
    }
    if (!apiKey) {
      return reply
        .status(400)
        .send({ error: 'No PageSpeed API key found. Add a PageSpeed API key in account settings.' })
    }

    const targetUrl = parsed.data.url.trim()
    const projectHost = new URL(project.rootUrl).hostname.toLowerCase().replace(/^www\./, '')
    const targetHost = new URL(targetUrl).hostname.toLowerCase().replace(/^www\./, '')
    if (projectHost !== targetHost) {
      return reply.status(400).send({ error: 'URL must be within the selected project domain' })
    }

    try {
      const run = await runPageSpeed({
        url: targetUrl,
        strategy: parsed.data.strategy,
        apiKey,
      })

      const created = await fastify.prisma.speedTest.create({
        data: {
          projectId: project.id,
          createdByUserId: request.user!.id,
          url: run.finalUrl ?? targetUrl,
          strategy: parsed.data.strategy,
          fetchedAt: new Date(run.fetchedAt),
          performanceScore: run.performanceScore,
          accessibilityScore: run.accessibilityScore,
          bestPracticesScore: run.bestPracticesScore,
          seoScore: run.seoScore,
          pwaScore: run.pwaScore,
          firstContentfulPaintMs: run.firstContentfulPaintMs,
          largestContentfulPaintMs: run.largestContentfulPaintMs,
          cumulativeLayoutShift: run.cumulativeLayoutShift,
          interactionToNextPaintMs: run.interactionToNextPaintMs,
          totalBlockingTimeMs: run.totalBlockingTimeMs,
          speedIndexMs: run.speedIndexMs,
          rawJson: run.rawJson as import('@prisma/client').Prisma.InputJsonValue,
        },
      })
      return speedTestDto(created)
    } catch (e: unknown) {
      const err = e as { message?: string; statusCode?: number }
      return reply
        .status(typeof err.statusCode === 'number' ? err.statusCode : 400)
        .send({ error: err.message ?? 'Speed test failed' })
    }
  })

  fastify.get('/projects/:id/speed-tests', async (request, reply) => {
    const { id } = request.params as { id: string }
    const project = await fastify.prisma.project.findFirst({
      where: { id, userId: request.user!.id },
      select: { id: true },
    })
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const tests = await fastify.prisma.speedTest.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return { items: tests.map(speedTestDto) }
  })

  fastify.get('/speed-tests/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const test = await fastify.prisma.speedTest.findFirst({
      where: {
        id,
        project: { userId: request.user!.id },
      },
    })
    if (!test) return reply.status(404).send({ error: 'Speed test not found' })
    return speedTestDto(test)
  })

  fastify.delete('/speed-tests/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const existing = await fastify.prisma.speedTest.findFirst({
      where: { id, project: { userId: request.user!.id } },
      select: { id: true },
    })
    if (!existing) return reply.status(404).send({ error: 'Speed test not found' })
    await fastify.prisma.speedTest.delete({ where: { id: existing.id } })
    return reply.status(204).send()
  })
}

export default speedTestsRoutes
