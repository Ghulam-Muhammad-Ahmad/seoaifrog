import type { FastifyPluginAsync } from 'fastify'
import { readFile } from 'node:fs/promises'
import { z } from 'zod'
import { saveAuditReport } from '../lib/reportPersistence.js'

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

    const list = await fastify.prisma.report.findMany({
      where: { projectId },
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
