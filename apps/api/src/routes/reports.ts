import type { FastifyPluginAsync } from 'fastify'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { saveAuditReport } from '../lib/reportPersistence.js'
import { buildSpeedTestReportMarkdown } from '../lib/reportBuilder.js'
import { resolveStoragePath } from '../lib/paths.js'

async function assertProject(fastify: { prisma: import('@prisma/client').PrismaClient }, userId: string, projectId: string) {
  return fastify.prisma.project.findFirst({
    where: { id: projectId, userId },
  })
}

function reportUrls(reportId: string) {
  return {
    downloadUrl: `/api/reports/${reportId}/download`,
    exportUrl: `/api/reports/${reportId}/export`,
  }
}

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', fastify.authenticate)

  fastify.get('/projects/:id/reports', async (request, reply) => {
    const { id: projectId } = request.params as { id: string }
    const project = await assertProject(fastify, request.user!.id, projectId)
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const q = request.query as { view?: string }
    const view = q.view === 'archived' ? 'archived' : q.view === 'all' ? 'all' : 'active'
    // Active = not archived (includes legacy docs before `archived` existed in MongoDB)
    const where =
      view === 'all'
        ? { projectId }
        : view === 'archived'
          ? { projectId, archived: true }
          : { projectId, NOT: { archived: true } }

    const list = await fastify.prisma.report.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })
    return list.map((r) => {
      const u = reportUrls(r.id)
      return {
        id: r.id,
        projectId: r.projectId,
        auditId: r.auditId,
        title: r.title,
        format: r.format,
        overallScore: r.overallScore,
        archived: r.archived,
        createdAt: r.createdAt.toISOString(),
        downloadUrl: u.downloadUrl,
        exportUrl: u.exportUrl,
      }
    })
  })

  fastify.post('/projects/:id/reports', async (request, reply) => {
    const { id: projectId } = request.params as { id: string }
    const project = await assertProject(fastify, request.user!.id, projectId)
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const parsed = z
      .object({
        auditId: z.string().min(1),
        title: z.string().min(1).optional(),
      })
      .safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const saved = await saveAuditReport(fastify.prisma, parsed.data.auditId, {
      projectId,
      title: parsed.data.title,
    })
    if (!saved) return reply.status(404).send({ error: 'Audit not found' })

    const u = reportUrls(saved.report.id)
    return {
      id: saved.report.id,
      projectId: saved.report.projectId,
      auditId: saved.report.auditId,
      title: saved.report.title,
      format: saved.report.format,
      overallScore: saved.report.overallScore,
      archived: saved.report.archived,
      createdAt: saved.report.createdAt.toISOString(),
      downloadUrl: u.downloadUrl,
      exportUrl: u.exportUrl,
      markdown: saved.markdown,
    }
  })

  fastify.get('/reports/:id/download', async (request, reply) => {
    const { id } = request.params as { id: string }
    const report = await fastify.prisma.report.findFirst({
      where: { id, project: { userId: request.user!.id } },
    })
    if (!report?.filePath) return reply.status(404).send({ error: 'Not found' })

    const body = await readFile(report.filePath, 'utf8')
    const { mime, ext } = reportMime(report)
    return reply
      .header('Content-Type', mime)
      .header('Content-Disposition', `inline; filename="${safeFilename(report.title)}.${ext}"`)
      .send(body)
  })

  fastify.get('/reports/:id/export', async (request, reply) => {
    const { id } = request.params as { id: string }
    const report = await fastify.prisma.report.findFirst({
      where: { id, project: { userId: request.user!.id } },
    })
    if (!report?.filePath) return reply.status(404).send({ error: 'Not found' })

    const body = await readFile(report.filePath, 'utf8')
    const { mime, ext } = reportMime(report)
    return reply
      .header('Content-Type', mime)
      .header(
        'Content-Disposition',
        `attachment; filename="${safeFilename(report.title)}-${report.id.slice(0, 8)}.${ext}"`,
      )
      .send(body)
  })

  // ── Speed test → report ──────────────────────────────────────────────────
  fastify.post('/projects/:id/speed-test-reports', async (request, reply) => {
    const { id: projectId } = request.params as { id: string }
    const project = await assertProject(fastify, request.user!.id, projectId)
    if (!project) return reply.status(404).send({ error: 'Project not found' })

    const parsed = z
      .object({ speedTestId: z.string().min(1).optional() })
      .safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const whereClause = parsed.data.speedTestId
      ? { projectId, id: parsed.data.speedTestId }
      : { projectId }

    const tests = await fastify.prisma.speedTest.findMany({
      where: whereClause,
      orderBy: { fetchedAt: 'desc' },
      take: 20,
    })
    if (tests.length === 0) return reply.status(404).send({ error: 'No speed tests found' })

    const domain = project.domain ?? new URL(project.rootUrl).hostname
    const dateStr = new Date().toLocaleDateString('en-GB')
    const title = `Speed Report — ${domain} — ${dateStr}`

    const markdown = buildSpeedTestReportMarkdown(title, domain, tests.map((t) => ({
      id: t.id,
      url: t.url,
      strategy: t.strategy,
      fetchedAt: t.fetchedAt,
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
    })))

    const avgPerf = tests.reduce((s, t) => s + (t.performanceScore ?? 0), 0) / tests.length
    const overallScore = Math.round(avgPerf)

    const base = resolveStoragePath()
    const reportsDir = join(base, 'reports')
    await mkdir(reportsDir, { recursive: true })

    const report = await fastify.prisma.report.create({
      data: {
        projectId,
        auditId: null,
        title,
        format: 'markdown',
        overallScore,
        summary: null,
        shareToken: randomUUID(),
      },
    })

    const filePath = join(reportsDir, `${report.id}.md`)
    await writeFile(filePath, markdown, 'utf8')
    const st = await stat(filePath)

    const updated = await fastify.prisma.report.update({
      where: { id: report.id },
      data: { filePath, fileSize: st.size },
    })

    const u = reportUrls(updated.id)
    return {
      id: updated.id,
      projectId: updated.projectId,
      auditId: updated.auditId,
      title: updated.title,
      format: updated.format,
      overallScore: updated.overallScore,
      archived: updated.archived,
      createdAt: updated.createdAt.toISOString(),
      downloadUrl: u.downloadUrl,
      exportUrl: u.exportUrl,
    }
  })

  fastify.patch('/reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const parsed = z.object({ archived: z.boolean() }).safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' })

    const existing = await fastify.prisma.report.findFirst({
      where: { id, project: { userId: request.user!.id } },
    })
    if (!existing) return reply.status(404).send({ error: 'Not found' })

    const report = await fastify.prisma.report.update({
      where: { id },
      data: { archived: parsed.data.archived },
    })
    const u = reportUrls(report.id)
    return {
      id: report.id,
      projectId: report.projectId,
      auditId: report.auditId,
      title: report.title,
      format: report.format,
      overallScore: report.overallScore,
      archived: report.archived,
      createdAt: report.createdAt.toISOString(),
      downloadUrl: u.downloadUrl,
      exportUrl: u.exportUrl,
    }
  })

  fastify.get('/reports/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const report = await fastify.prisma.report.findFirst({
      where: { id, project: { userId: request.user!.id } },
    })
    if (!report) return reply.status(404).send({ error: 'Not found' })
    const u = reportUrls(report.id)
    return {
      id: report.id,
      projectId: report.projectId,
      auditId: report.auditId,
      title: report.title,
      format: report.format,
      overallScore: report.overallScore,
      archived: report.archived,
      createdAt: report.createdAt.toISOString(),
      downloadUrl: u.downloadUrl,
      exportUrl: u.exportUrl,
    }
  })
}

function safeFilename(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
  return s || 'report'
}

function reportMime(report: { format: string; filePath: string | null }): { mime: string; ext: string } {
  const path = report.filePath ?? ''
  if (report.format === 'markdown' || path.endsWith('.md')) {
    return { mime: 'text/markdown; charset=utf-8', ext: 'md' }
  }
  return { mime: 'text/html; charset=utf-8', ext: 'html' }
}

export default reportsRoutes
