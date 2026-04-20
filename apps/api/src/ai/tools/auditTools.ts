import type { PrismaClient } from '@prisma/client'
import got from 'got'
import * as cheerio from 'cheerio'
import OpenAI from 'openai'
import { OpenAIEmbeddings } from '../OpenAIEmbeddings.js'
import { extractJsonLdFromHtml } from '../../crawler/jsonld.js'

export type AuditToolContext = {
  prisma: PrismaClient
  projectId: string
  project: { name: string; domain: string; rootUrl: string }
  crawlSessionId: string | null
  targetUrl: string | null
  openAiApiKey: string
}

export type AuditToolCallLog = {
  name: string
  argsJson: string
  resultPreview: string
  durationMs: number
  ok: boolean
  error?: string
}

function clampInt(v: unknown, def: number, min: number, max: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n)) return def
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function toVec(j: unknown): number[] | null {
  if (!Array.isArray(j)) return null
  if (!j.every((x) => typeof x === 'number')) return null
  return j as number[]
}

function cosineSim(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const d = Math.sqrt(na) * Math.sqrt(nb)
  return d === 0 ? 0 : dot / d
}

function histogram(codes: (number | null | undefined)[]): Record<string, number> {
  const h: Record<string, number> = {}
  for (const c of codes) {
    const k = String(c ?? 'unknown')
    h[k] = (h[k] ?? 0) + 1
  }
  return h
}

function truncate(s: unknown, max: number): unknown {
  if (typeof s !== 'string') return s
  return s.length <= max ? s : s.slice(0, max) + '…[truncated]'
}

/** OpenAI Responses-API tool definitions (`type: "function"`). */
export const AUDIT_TOOL_DEFINITIONS = [
  {
    type: 'function' as const,
    name: 'search_pages',
    description:
      'Semantic search over crawled page content (embeddings). Returns top matching chunks with page URLs and similarity scores. Use when you need evidence from page bodies for a specific SEO topic.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        query: { type: 'string', description: 'Natural-language query to match against page content.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 },
      },
      required: ['query'],
    },
  },
  {
    type: 'function' as const,
    name: 'get_page',
    description:
      'Fetch stored crawl data for a single URL from the current crawl session: meta tags, headings, schema JSON-LD, link counts, core web vitals.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    type: 'function' as const,
    name: 'list_pages',
    description:
      'List pages in the crawl filtered by simple criteria. Useful to find problem pages (broken, thin, missing title, redirects, no schema).',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        filter: {
          type: 'string',
          enum: [
            'all',
            'missing_title',
            'missing_meta_description',
            'thin_content',
            'broken',
            'redirects',
            'non_indexable',
            'no_schema',
            'slow_lcp',
          ],
          default: 'all',
        },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
      required: [],
    },
  },
  {
    type: 'function' as const,
    name: 'get_crawl_stats',
    description:
      'Aggregate stats for the current crawl session: total pages, status histogram, thin/missing-title counts, schema coverage, indexable counts.',
    parameters: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    type: 'function' as const,
    name: 'get_speed_tests',
    description:
      'PageSpeed Insights data already stored for this project. Returns the most recent tests. Optionally filter by URL.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 20, default: 10 },
      },
    },
  },
  {
    type: 'function' as const,
    name: 'fetch_live_page',
    description:
      'Fetch the live URL right now (HTTP GET) and parse basic SEO signals. Use to verify fresh state or when a URL is missing from the crawl. Only URLs on the project domain are allowed.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { url: { type: 'string' } },
      required: ['url'],
    },
  },
  {
    type: 'function' as const,
    name: 'list_page_issues',
    description:
      'List PageIssue rows attached to crawled pages, optionally filtered by category and/or severity. Useful for pulling structured issue data already captured by the crawler.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        category: {
          type: 'string',
          enum: [
            'TECHNICAL',
            'CONTENT',
            'LINKS',
            'IMAGES',
            'SCHEMA',
            'PERFORMANCE',
            'MOBILE',
            'SECURITY',
            'INTERNATIONAL',
          ],
        },
        severity: { type: 'string', enum: ['CRITICAL', 'WARNING', 'INFO'] },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
    },
  },
]

const PAGE_SELECT = {
  id: true,
  url: true,
  statusCode: true,
  redirectUrl: true,
  contentType: true,
  indexable: true,
  crawlDepth: true,
  responseTimeMs: true,
  htmlSize: true,
  title: true,
  titleLength: true,
  metaDescription: true,
  metaDescLength: true,
  metaRobots: true,
  canonical: true,
  ogTitle: true,
  ogDescription: true,
  ogImage: true,
  h1Count: true,
  h1Text: true,
  headingsJson: true,
  internalLinks: true,
  externalLinks: true,
  linksJson: true,
  imageCount: true,
  imagesMissingAlt: true,
  imagesJson: true,
  hasSchema: true,
  schemaTypes: true,
  schemaJson: true,
  hreflangJson: true,
  wordCount: true,
  readabilityScore: true,
  lcp: true,
  cls: true,
  ttfb: true,
  crawledAt: true,
} as const

function shrinkPage(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  out.h1Text = truncate(out.h1Text, 400)
  out.metaDescription = truncate(out.metaDescription, 500)
  out.headingsJson = truncate(out.headingsJson, 6000)
  out.linksJson = truncate(out.linksJson, 8000)
  out.imagesJson = truncate(out.imagesJson, 10_000)
  out.schemaJson = truncate(out.schemaJson, 10_000)
  out.hreflangJson = truncate(out.hreflangJson, 6000)
  return out
}

/**
 * Dispatches an OpenAI function-call by name. Returns the JSON string to feed
 * back as a `function_call_output`. Never throws — errors are returned as
 * structured payloads so the model can recover.
 */
export async function dispatchAuditTool(
  ctx: AuditToolContext,
  name: string,
  argsJson: string,
): Promise<{ output: string; log: AuditToolCallLog }> {
  const started = Date.now()
  let args: Record<string, unknown> = {}
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {}
  } catch {
    const output = JSON.stringify({ error: 'Invalid JSON arguments', received: argsJson.slice(0, 200) })
    return {
      output,
      log: {
        name,
        argsJson,
        resultPreview: output.slice(0, 300),
        durationMs: Date.now() - started,
        ok: false,
        error: 'bad-args-json',
      },
    }
  }

  try {
    const raw = await runTool(ctx, name, args)
    let output = typeof raw === 'string' ? raw : JSON.stringify(raw)
    const maxOut = Math.max(4000, parseInt(process.env.OPENAI_TOOL_OUTPUT_MAX ?? '12000', 10) || 12000)
    if (output.length > maxOut) {
      output = output.slice(0, maxOut) + '…[truncated, tool output exceeded OPENAI_TOOL_OUTPUT_MAX]'
    }
    return {
      output,
      log: {
        name,
        argsJson: JSON.stringify(args),
        resultPreview: output.slice(0, 300),
        durationMs: Date.now() - started,
        ok: true,
      },
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const output = JSON.stringify({ error: msg })
    return {
      output,
      log: {
        name,
        argsJson: JSON.stringify(args),
        resultPreview: output.slice(0, 300),
        durationMs: Date.now() - started,
        ok: false,
        error: msg,
      },
    }
  }
}

async function runTool(ctx: AuditToolContext, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { prisma, crawlSessionId } = ctx

  switch (name) {
    case 'search_pages': {
      if (!crawlSessionId) return { error: 'No crawl session attached to this audit.' }
      const query = String(args.query ?? '').trim()
      if (!query) return { error: 'query is required' }
      const limit = clampInt(args.limit, 10, 1, 50)

      const openai = new OpenAI({ apiKey: ctx.openAiApiKey })
      const emb = new OpenAIEmbeddings(openai)
      const qVec = await emb.embedQuery(query)

      const rows = await prisma.crawlTextChunk.findMany({
        where: { crawlSessionId },
        select: { pageId: true, url: true, chunkIndex: true, text: true, embedding: true },
      })
      if (rows.length === 0) {
        return { note: 'No embeddings stored for this crawl. Use list_pages or get_page instead.', results: [] }
      }
      const scored = rows
        .map((r) => {
          const v = toVec(r.embedding)
          if (!v) return null
          return {
            url: r.url,
            chunkIndex: r.chunkIndex,
            text: truncate(r.text, 1500) as string,
            similarity: Math.round(cosineSim(qVec, v) * 1000) / 1000,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x != null)
      scored.sort((a, b) => b.similarity - a.similarity)
      return { query, results: scored.slice(0, limit) }
    }

    case 'get_page': {
      if (!crawlSessionId) return { error: 'No crawl session attached to this audit.' }
      const url = String(args.url ?? '').trim()
      if (!url) return { error: 'url is required' }
      const row = await prisma.crawledPage.findFirst({
        where: { crawlSessionId, url },
        select: PAGE_SELECT,
      })
      if (!row) return { error: 'URL not found in crawl session', url }
      return shrinkPage(row as unknown as Record<string, unknown>)
    }

    case 'list_pages': {
      if (!crawlSessionId) return { error: 'No crawl session attached to this audit.' }
      const filter = String(args.filter ?? 'all')
      const limit = clampInt(args.limit, 50, 1, 200)
      const where: import('@prisma/client').Prisma.CrawledPageWhereInput = { crawlSessionId }
      switch (filter) {
        case 'missing_title':
          where.OR = [{ title: null }, { title: '' }]
          break
        case 'missing_meta_description':
          where.OR = [{ metaDescription: null }, { metaDescription: '' }]
          break
        case 'thin_content':
          where.wordCount = { lt: 300 }
          break
        case 'broken':
          where.statusCode = { gte: 400 }
          break
        case 'redirects':
          where.statusCode = { gte: 300, lt: 400 }
          break
        case 'non_indexable':
          where.indexable = false
          break
        case 'no_schema':
          where.hasSchema = false
          break
        case 'slow_lcp':
          where.lcp = { gt: 2500 }
          break
      }
      const pages = await prisma.crawledPage.findMany({
        where,
        take: limit,
        orderBy: { crawledAt: 'asc' },
        select: {
          url: true,
          statusCode: true,
          title: true,
          wordCount: true,
          indexable: true,
          canonical: true,
          hasSchema: true,
          lcp: true,
        },
      })
      const total = await prisma.crawledPage.count({ where })
      return { filter, total, returned: pages.length, pages }
    }

    case 'get_crawl_stats': {
      if (!crawlSessionId) return { error: 'No crawl session attached to this audit.' }
      const total = await prisma.crawledPage.count({ where: { crawlSessionId } })
      const all = await prisma.crawledPage.findMany({
        where: { crawlSessionId },
        select: {
          statusCode: true,
          indexable: true,
          hasSchema: true,
          wordCount: true,
          title: true,
          metaDescription: true,
          lcp: true,
        },
      })
      const statusHistogram = histogram(all.map((p) => p.statusCode))
      let indexable = 0
      let withSchema = 0
      let thin = 0
      let missingTitle = 0
      let missingMeta = 0
      let slowLcp = 0
      for (const p of all) {
        if (p.indexable === true) indexable++
        if (p.hasSchema === true) withSchema++
        if ((p.wordCount ?? 0) < 300) thin++
        if (!p.title) missingTitle++
        if (!p.metaDescription) missingMeta++
        if ((p.lcp ?? 0) > 2500) slowLcp++
      }
      return {
        total,
        statusHistogram,
        indexable,
        withSchema,
        thinContent: thin,
        missingTitle,
        missingMetaDescription: missingMeta,
        slowLcp,
      }
    }

    case 'get_speed_tests': {
      const url = typeof args.url === 'string' && args.url.trim() ? args.url.trim() : undefined
      const limit = clampInt(args.limit, 10, 1, 20)
      const rows = await prisma.speedTest.findMany({
        where: { projectId: ctx.projectId, ...(url ? { url } : {}) },
        orderBy: { fetchedAt: 'desc' },
        take: limit,
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

    case 'fetch_live_page': {
      const url = String(args.url ?? '').trim()
      if (!url) return { error: 'url is required' }
      const target = new URL(url)
      const root = new URL(ctx.project.rootUrl)
      const norm = (h: string) => h.toLowerCase().replace(/^www\./, '')
      if (norm(target.hostname) !== norm(root.hostname)) {
        return { error: 'URL is outside the project domain', url }
      }
      const res = await got(url, {
        throwHttpErrors: false,
        followRedirect: true,
        maxRedirects: 5,
        timeout: { request: 15_000 },
      })
      const contentType = typeof res.headers['content-type'] === 'string' ? res.headers['content-type'] : null
      const body = res.body
      const htmlLike = Boolean(body) && (contentType?.includes('text/html') ?? true)
      if (!htmlLike) {
        return { url, statusCode: res.statusCode, contentType, note: 'Not HTML.' }
      }
      const $ = cheerio.load(body)
      const title = $('title').first().text().trim() || null
      const metaDescription = $('meta[name="description"]').attr('content')?.trim() ?? null
      const h1 = $('h1').first().text().trim() || null
      const wordCount = $('body').text().replace(/\s+/g, ' ').trim().split(/\s+/).filter(Boolean).length
      const { hasSchema, schemaTypes } = extractJsonLdFromHtml($)
      return { url, statusCode: res.statusCode, contentType, title, metaDescription, h1, wordCount, hasSchema, schemaTypes }
    }

    case 'list_page_issues': {
      if (!crawlSessionId) return { error: 'No crawl session attached to this audit.' }
      const limit = clampInt(args.limit, 50, 1, 200)
      const where: import('@prisma/client').Prisma.PageIssueWhereInput = {
        page: { crawlSessionId },
      }
      if (typeof args.category === 'string') where.category = args.category as never
      if (typeof args.severity === 'string') where.severity = args.severity as never
      const rows = await prisma.pageIssue.findMany({
        where,
        take: limit,
        select: {
          category: true,
          severity: true,
          code: true,
          message: true,
          detail: true,
          page: { select: { url: true } },
        },
      })
      return rows.map((r) => ({
        url: r.page.url,
        category: r.category,
        severity: r.severity,
        code: r.code,
        message: r.message,
        detail: truncate(r.detail, 500),
      }))
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}
