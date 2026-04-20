import type { PrismaClient } from '@prisma/client'
import got from 'got'
import * as cheerio from 'cheerio'
import {
  buildEmbeddingRetrievalPayload,
  embeddingAuditEnabled,
} from './embeddings/crawlEmbeddingService.js'
import { serializeCrawlSession } from './crawlSessionSerialize.js'
import { extractJsonLdFromHtml } from '../crawler/jsonld.js'
import {
  getSkillPayloadProfile,
  shrinkPageRowForSkill,
  type PageForPayload,
} from './skillPayloadProfile.js'

export type SkillPayloadContext = {
  projectId: string
  project: { name: string; domain: string; rootUrl: string }
  crawlSessionId: string | null
  targetUrl: string | null
  openAiApiKey?: string
}

/**
 * Slim upfront payload used when the audit runs in tool-calling mode.
 * The model has function tools to pull page-level data on demand, so we only
 * include project metadata, crawl summary, a status histogram, and speed tests.
 */
export async function buildToolUsePayload(
  prisma: PrismaClient,
  skillName: string,
  ctx: SkillPayloadContext,
): Promise<string> {
  const speedTests = await getRelevantSpeedTests(prisma, ctx.projectId, ctx.targetUrl)
  const base = {
    dataSource: 'tool_use',
    skillName,
    projectId: ctx.projectId,
    project: ctx.project,
    targetUrl: ctx.targetUrl,
    speedTests,
  }

  if (!ctx.crawlSessionId) {
    const livePage =
      ctx.targetUrl != null
        ? await fetchTargetUrlSnapshot(ctx.targetUrl, ctx.project.rootUrl).catch(() => null)
        : null
    return JSON.stringify({
      ...base,
      crawlSession: null,
      livePage,
      note: 'No crawl session linked. Use fetch_live_page for live checks; crawl-scoped tools will return an error.',
    })
  }

  const session = await prisma.crawlSession.findFirst({
    where: { id: ctx.crawlSessionId, projectId: ctx.projectId },
  })
  if (!session) {
    return JSON.stringify({
      ...base,
      crawlSession: null,
      note: 'crawlSessionId set but not found for this project.',
    })
  }

  const totalPagesInCrawl = await prisma.crawledPage.count({
    where: { crawlSessionId: ctx.crawlSessionId },
  })
  const statusRows = await prisma.crawledPage.findMany({
    where: { crawlSessionId: ctx.crawlSessionId },
    select: { statusCode: true },
  })
  const statusHistogram = histogram(statusRows.map((r) => r.statusCode))
  const crawlSession = serializeCrawlSession(session, totalPagesInCrawl, 0, 0)

  return JSON.stringify({
    ...base,
    crawlSession,
    aggregateCrawlStats: {
      totalPagesInCrawl,
      statusHistogram,
    },
    note:
      'Use the provided function tools (search_pages, get_page, list_pages, get_crawl_stats, list_page_issues, get_speed_tests, fetch_live_page) to pull specific evidence. Do not ask the user for data.',
  })
}

export async function buildPayloadForSkill(
  prisma: PrismaClient,
  skillName: string,
  ctx: SkillPayloadContext,
): Promise<string> {
  const profile = getSkillPayloadProfile(skillName)
  const speedTests = await getRelevantSpeedTests(prisma, ctx.projectId, ctx.targetUrl)
  const baseMeta = {
    skillName,
    projectId: ctx.projectId,
    project: ctx.project,
    crawlSession: null as ReturnType<typeof serializeCrawlSession> | null,
    targetUrl: ctx.targetUrl,
    payloadProfile: { maxPages: profile.maxPages },
    speedTests,
  }

  if (!ctx.crawlSessionId) {
    const livePage =
      ctx.targetUrl != null ? await fetchTargetUrlSnapshot(ctx.targetUrl, ctx.project.rootUrl).catch(() => null) : null
    return JSON.stringify({
      ...baseMeta,
      livePage,
      note: ctx.targetUrl
        ? 'No crawl session linked to this audit. Audit is scoped to targetUrl + project metadata only.'
        : 'No crawl session linked to this audit — select a crawl when starting the audit to include crawl data.',
    })
  }

  const session = await prisma.crawlSession.findFirst({
    where: { id: ctx.crawlSessionId, projectId: ctx.projectId },
  })

  if (!session) {
    return JSON.stringify({
      ...baseMeta,
      note: 'crawlSessionId was set but no crawl session matched this project (invalid or deleted).',
      crawlSessionIdRequested: ctx.crawlSessionId,
    })
  }

  const totalPagesInCrawl = await prisma.crawledPage.count({
    where: { crawlSessionId: ctx.crawlSessionId },
  })

  const chunkCount = await prisma.crawlTextChunk.count({
    where: { crawlSessionId: ctx.crawlSessionId },
  })

  if (embeddingAuditEnabled() && chunkCount > 0 && !ctx.targetUrl) {
    return buildEmbeddingRetrievalPayload(
      prisma,
      skillName,
      ctx,
      session,
      totalPagesInCrawl,
      speedTests,
    )
  }

  const pageWhere: import('@prisma/client').Prisma.CrawledPageWhereInput = {
    crawlSessionId: ctx.crawlSessionId,
  }
  if (ctx.targetUrl) pageWhere.url = ctx.targetUrl

  const rawPages = await prisma.crawledPage.findMany({
    where: pageWhere,
    take: profile.maxPages,
    orderBy: { crawledAt: 'asc' },
    select: profile.select,
  })

  const pages = rawPages.map((p) => shrinkPageRowForSkill(skillName, p as PageForPayload))

  const crawlSession = serializeCrawlSession(
    session,
    totalPagesInCrawl,
    pages.length,
    profile.maxPages,
  )

  const statusHistogram = histogram(rawPages.map((p) => p.statusCode))
  const lowWordCount = rawPages
    .filter((p) => (p.wordCount ?? 0) < 300)
    .slice(0, 50)
    .map((p) => ({ url: p.url, wordCount: p.wordCount }))
  const missingTitle = rawPages.filter((p) => !p.title).slice(0, 50).map((p) => p.url)

  const summary: Record<string, unknown> = {
    ...baseMeta,
    crawlSession,
    totalPagesSample: pages.length,
    statusHistogram,
    lowWordCount,
    missingTitle,
    pages,
  }

  if (ctx.targetUrl && rawPages.length === 0) {
    summary.note =
      'targetUrl was provided, but this URL was not found in the selected crawl session. Run a crawl including this URL, or run without crawl.'
    summary.livePage =
      (await fetchTargetUrlSnapshot(ctx.targetUrl, ctx.project.rootUrl).catch(() => null)) ?? null
  }

  return JSON.stringify(summary, null, 2)
}

async function getRelevantSpeedTests(
  prisma: PrismaClient,
  projectId: string,
  targetUrl: string | null,
): Promise<
  Array<{
    url: string
    strategy: string
    fetchedAt: string
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
  }>
> {
  const rows = await prisma.speedTest.findMany({
    where: {
      projectId,
      ...(targetUrl ? { url: targetUrl } : {}),
    },
    orderBy: { fetchedAt: 'desc' },
    take: 10,
    select: {
      url: true,
      strategy: true,
      fetchedAt: true,
      performanceScore: true,
      accessibilityScore: true,
      bestPracticesScore: true,
      seoScore: true,
      pwaScore: true,
      firstContentfulPaintMs: true,
      largestContentfulPaintMs: true,
      cumulativeLayoutShift: true,
      interactionToNextPaintMs: true,
      totalBlockingTimeMs: true,
      speedIndexMs: true,
    },
  })
  return rows.map((r) => ({
    url: r.url,
    strategy: r.strategy,
    fetchedAt: r.fetchedAt.toISOString(),
    performanceScore: r.performanceScore,
    accessibilityScore: r.accessibilityScore,
    bestPracticesScore: r.bestPracticesScore,
    seoScore: r.seoScore,
    pwaScore: r.pwaScore,
    firstContentfulPaintMs: r.firstContentfulPaintMs,
    largestContentfulPaintMs: r.largestContentfulPaintMs,
    cumulativeLayoutShift: r.cumulativeLayoutShift,
    interactionToNextPaintMs: r.interactionToNextPaintMs,
    totalBlockingTimeMs: r.totalBlockingTimeMs,
    speedIndexMs: r.speedIndexMs,
  }))
}

function histogram(codes: (number | null)[]): Record<string, number> {
  const h: Record<string, number> = {}
  for (const c of codes) {
    const k = String(c ?? 'unknown')
    h[k] = (h[k] ?? 0) + 1
  }
  return h
}

async function fetchTargetUrlSnapshot(
  targetUrl: string,
  projectRootUrl: string,
): Promise<Record<string, unknown>> {
  const target = new URL(targetUrl)
  const root = new URL(projectRootUrl)
  const normalizeHost = (host: string) => host.toLowerCase().replace(/^www\./, '')
  if (normalizeHost(target.hostname) !== normalizeHost(root.hostname)) {
    return { url: targetUrl, error: 'URL is outside project domain' }
  }

  const res = await got(targetUrl, {
    throwHttpErrors: false,
    followRedirect: true,
    maxRedirects: 5,
    timeout: { request: 15_000 },
  })
  const contentType = typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : null
  const body = res.body
  const htmlLike = Boolean(body) && (contentType?.includes('text/html') ?? true)
  if (!htmlLike) {
    return {
      url: targetUrl,
      statusCode: res.statusCode,
      contentType,
      note: 'Target URL is not HTML content.',
    }
  }

  const $ = cheerio.load(body)
  const title = $('title').first().text().trim() || null
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() ?? null
  const h1 = $('h1').first().text().trim() || null
  const wordCount = $('body')
    .text()
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length
  const { hasSchema, schemaTypes } = extractJsonLdFromHtml($)

  return {
    url: targetUrl,
    statusCode: res.statusCode,
    contentType,
    title,
    metaDescription,
    h1,
    wordCount,
    hasSchema,
    schemaTypes,
  }
}
