import type { PrismaClient, Report } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveStoragePath } from './paths.js'
import { buildReportMarkdown } from './reportBuilder.js'

type SaveAuditReportOptions = {
  projectId?: string
  title?: string
}

export type SavedAuditReport = {
  report: Report
  markdown: string
  created: boolean
}

export async function saveAuditReport(
  prisma: PrismaClient,
  auditId: string,
  opts: SaveAuditReportOptions = {},
): Promise<SavedAuditReport | null> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: { project: true, skillResults: true },
  })
  if (!audit) return null
  if (opts.projectId && audit.projectId !== opts.projectId) return null

  const existing = await prisma.report.findFirst({
    where: { auditId },
    orderBy: { createdAt: 'desc' },
  })
  if (existing?.filePath) {
    try {
      const markdown = await readFile(existing.filePath, 'utf8')
      return { report: existing, markdown, created: false }
    } catch {
      // Continue and regenerate the file if path is stale.
    }
  }

  const title = opts.title?.trim() || existing?.title || `Report — ${audit.project.name}`
  const speedRows = await prisma.speedTest.findMany({
    where: { projectId: audit.projectId },
    orderBy: { fetchedAt: 'desc' },
    take: 5,
    select: {
      url: true,
      strategy: true,
      fetchedAt: true,
      performanceScore: true,
      accessibilityScore: true,
      bestPracticesScore: true,
      seoScore: true,
      pwaScore: true,
      largestContentfulPaintMs: true,
      cumulativeLayoutShift: true,
      interactionToNextPaintMs: true,
    },
  })
  const markdown = buildReportMarkdown(
    title,
    audit.project.domain,
    audit.overallScore,
    audit.skillResults,
    speedRows,
  )

  const base = resolveStoragePath()
  const reportsDir = join(base, 'reports')
  await mkdir(reportsDir, { recursive: true })

  let report = existing
  if (!report) {
    report = await prisma.report.create({
      data: {
        projectId: audit.projectId,
        auditId: audit.id,
        title,
        format: 'markdown',
        overallScore: audit.overallScore,
        summary: null,
        shareToken: randomUUID(),
      },
    })
  }

  const filePath = join(reportsDir, `${report.id}.md`)
  await writeFile(filePath, markdown, 'utf8')
  const st = await stat(filePath)

  const updated = await prisma.report.update({
    where: { id: report.id },
    data: {
      filePath,
      fileSize: st.size,
      overallScore: audit.overallScore,
      title,
    },
  })

  return {
    report: updated,
    markdown,
    created: !existing,
  }
}
