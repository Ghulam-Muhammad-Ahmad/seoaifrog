import got from 'got'
import { chromium, type Browser } from 'playwright'
import * as cheerio from 'cheerio'
import type { PrismaClient } from '@prisma/client'
import { IssueCategory, IssueSeverity, CrawlStatus } from '@prisma/client'
import type { CrawlConfig } from '@seoaifrog/shared'
import { defaultCrawlConfig } from '@seoaifrog/shared'
import type { CrawledPageDTO, CrawlProgress, CrawlStats } from '@seoaifrog/shared'
import type { CrawlEventMessage } from '../lib/crawl-events.js'
import { CRAWL_EVENTS_CHANNEL } from '../lib/crawl-events.js'
import type { Redis } from 'ioredis'
import { extractJsonLdFromHtml } from './jsonld.js'
import { fetchHtmlWithPlaywright } from './playwrightFetch.js'
import { collectPageUrlsFromSitemaps, discoverSitemapEntryPoints } from './sitemap.js'

type QueueItem = { url: string; depth: number }

function mergeConfig(partial: Partial<CrawlConfig>): CrawlConfig {
  return {
    ...defaultCrawlConfig,
    ...partial,
    urlFilters: { ...defaultCrawlConfig.urlFilters, ...partial.urlFilters },
  }
}

function normalizeUrl(href: string, base: string): string | null {
  try {
    const u = new URL(href, base)
    u.hash = ''
    return u.href
  } catch {
    return null
  }
}

/** Ignores hyphens in labels + leading www — pairs genx-integrated-systems.com with genxintegratedsystems.com */
function normalizeHostnameForCrawl(host: string): string {
  const h = host.toLowerCase().replace(/^www\./, '')
  return h
    .split('.')
    .map((label) => label.replace(/-/g, ''))
    .join('.')
}

function hostMatchesCrawlRoot(linkHost: string, crawlRootHost: string): boolean {
  return normalizeHostnameForCrawl(linkHost) === normalizeHostnameForCrawl(crawlRootHost)
}

/** Internal URLs use the crawl start URL’s origin (exact host/protocol) so DB + queue match the user’s base, not marketing aliases. */
function rewriteInternalUrlToStartOrigin(resolved: string, crawlStartUrl: string): string {
  try {
    const u = new URL(resolved)
    const root = new URL(crawlStartUrl)
    if (!hostMatchesCrawlRoot(u.hostname, root.hostname)) return resolved
    u.protocol = root.protocol
    u.host = root.host
    return u.href
  } catch {
    return resolved
  }
}

function shouldIncludeUrl(url: string, cfg: CrawlConfig): boolean {
  // Keep crawl queue focused on HTML-like documents, not static asset files.
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    if (/\.(?:avif|bmp|gif|heic|ico|jpe?g|png|svg|tiff?|webp|mp4|webm|mov|avi|mp3|wav|pdf|zip|rar|7z|tar|gz|woff2?|ttf|eot)$/i.test(pathname)) {
      return false
    }
  } catch {
    return false
  }

  const { includePatterns, excludePatterns } = cfg.urlFilters
  const excluded = excludePatterns.some((p) => {
    try {
      return new RegExp(p).test(url)
    } catch {
      return false
    }
  })
  if (excluded) return false
  if (includePatterns.length === 0) return true
  return includePatterns.some((p) => {
    try {
      return new RegExp(p).test(url)
    } catch {
      return false
    }
  })
}

export interface CrawlEngineOptions {
  prisma: PrismaClient
  redis?: Redis
  crawlSessionId: string
  configJson: string
}

export async function runCrawlEngine(opts: CrawlEngineOptions): Promise<void> {
  const { prisma, redis, crawlSessionId } = opts
  let cfg: CrawlConfig
  try {
    cfg = mergeConfig(JSON.parse(opts.configJson) as Partial<CrawlConfig>)
  } catch {
    cfg = mergeConfig({})
  }

  const start = cfg.startUrl
  if (!start) {
    await prisma.crawlSession.update({
      where: { id: crawlSessionId },
      data: { status: CrawlStatus.FAILED, errorMessage: 'Missing startUrl', completedAt: new Date() },
    })
    return
  }
  const canonicalStart = normalizeUrl(start, start) ?? start

  const failSession = async (message: string) => {
    await prisma.crawlSession.update({
      where: { id: crawlSessionId },
      data: { status: CrawlStatus.FAILED, errorMessage: message, completedAt: new Date() },
    })
  }

  const publish = (type: CrawlEventMessage['type'], data: unknown) => {
    if (!redis) return
    const msg: CrawlEventMessage = { crawlId: crawlSessionId, type, data }
    void redis.publish(CRAWL_EVENTS_CHANNEL, JSON.stringify(msg))
  }

  const getStatus = async () => {
    const s = await prisma.crawlSession.findUnique({
      where: { id: crawlSessionId },
      select: { status: true },
    })
    return s?.status ?? CrawlStatus.CANCELLED
  }

  const isCancelled = async () => (await getStatus()) === CrawlStatus.CANCELLED

  const sessionStart = Date.now()
  let errors = 0
  let pagesCrawled = 0
  let lastProgressEmit = 0

  const startHostname = new URL(canonicalStart).hostname
  const concurrency = Math.max(1, cfg.concurrency)

  let queue: QueueItem[]
  const enqueued = new Set<string>()
  const fetched = new Set<string>()
  let followLinks = true

  if (cfg.crawlFromSitemapOnly) {
    const explicit = cfg.sitemapUrl?.trim()
    const entryPoints = explicit
      ? [explicit]
      : await discoverSitemapEntryPoints(canonicalStart, cfg.userAgent)
    if (entryPoints.length === 0) {
      await failSession(
        explicit
          ? 'Could not load the provided sitemap URL.'
          : 'No sitemap found (robots.txt Sitemap: lines or /sitemap.xml). Set an explicit sitemap URL or turn off sitemap-only mode.',
      )
      return
    }

    const rawUrls = await collectPageUrlsFromSitemaps(entryPoints, {
      userAgent: cfg.userAgent,
      maxSitemapFetches: 40,
      maxPageUrls: cfg.maxPages,
    })

    if (rawUrls.length === 0) {
      await failSession(
        explicit
          ? 'The sitemap URL did not return any parseable page URLs (check the URL and XML).'
          : 'Sitemaps were found but contained no page URLs, or they could not be fetched.',
      )
      return
    }

    const filtered = rawUrls.filter((u) => {
      try {
        return hostMatchesCrawlRoot(new URL(u).hostname, startHostname) && shouldIncludeUrl(u, cfg)
      } catch {
        return false
      }
    })

    if (filtered.length === 0) {
      await failSession(
        'No page URLs in the sitemap matched this crawl (same host as start URL and URL filters).',
      )
      return
    }

    queue = filtered.map((u) => ({
      url: rewriteInternalUrlToStartOrigin(u, canonicalStart),
      depth: 0,
    }))
    // Always crawl homepage first, even in sitemap-only mode and regardless of URL filters.
    queue = [{ url: canonicalStart, depth: 0 }, ...queue.filter((item) => item.url !== canonicalStart)]
    for (const item of queue) enqueued.add(item.url)
    followLinks = false
  } else {
    queue = [{ url: canonicalStart, depth: 0 }]
    enqueued.add(canonicalStart)
  }

  const maybeEmitProgress = () => {
    const now = Date.now()
    if (now - lastProgressEmit < 2000) return
    lastProgressEmit = now
    const elapsedSec = (now - sessionStart) / 1000
    const progress: CrawlProgress = {
      crawled: pagesCrawled,
      queued: queue.length,
      errors,
      pagesPerSec: elapsedSec > 0 ? pagesCrawled / elapsedSec : 0,
    }
    publish('crawl:progress', progress)
  }

  let browser: Browser | null = null
  if (cfg.renderJs) {
    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      await failSession(
        `Could not start Chromium for JavaScript rendering. Install browsers with: npx playwright install chromium — ${msg}`,
      )
      return
    }
  }

  const fetchAndPersist = async (url: string, depth: number): Promise<void> => {
    if (pagesCrawled >= cfg.maxPages) return
    if (depth > cfg.maxDepth) return
    if (url !== canonicalStart && !shouldIncludeUrl(url, cfg)) return

    const t0 = performance.now()
    let statusCode: number | null = null
    let body = ''
    let contentType: string | null = null
    let finalUrl = url

    try {
      if (cfg.renderJs && browser) {
        const doc = await fetchHtmlWithPlaywright(browser, url, cfg)
        statusCode = doc.statusCode
        body = doc.body
        contentType = doc.contentType ?? 'text/html'
        finalUrl = doc.finalUrl
      } else {
        const res = await got(url, {
          throwHttpErrors: false,
          followRedirect: cfg.followRedirects,
          maxRedirects: 10,
          timeout: { request: 30_000 },
          headers: { 'user-agent': cfg.userAgent },
          retry: { limit: 2, methods: ['GET'], statusCodes: [], errorCodes: ['ETIMEDOUT', 'ECONNRESET'] },
          decompress: true,
        })
        statusCode = res.statusCode
        body = res.body
        const ct = res.headers['content-type']
        contentType = typeof ct === 'string' ? ct : null
        finalUrl = res.url
      }
    } catch {
      statusCode = 0
      errors++
    }

    const responseTimeMs = Math.round(performance.now() - t0)

    if (body.length > cfg.maxFileSize) {
      errors++
      return
    }

    const htmlSize = Buffer.byteLength(body, 'utf8')
    let title: string | null = null
    let metaDescription: string | null = null
    let wordCount: number | null = null
    let h1Count = 0
    let h1Text: string | null = null
    const headingsForJson: { level: number; text: string }[] = []
    let internalLinks = 0
    let externalLinks = 0
    const internalTargets: string[] = []
    const linksForJson: { href: string; text: string; rel: string; isInternal: boolean }[] = []

    const treatAsHtml =
      Boolean(body) &&
      (contentType?.includes('text/html') || (cfg.renderJs && contentType == null))

    if (treatAsHtml && body) {
      const $ = cheerio.load(body)
      title = $('title').first().text().trim() || null
      metaDescription = $('meta[name="description"]').attr('content')?.trim() ?? null
      const h1s = $('h1')
      h1Count = h1s.length
      h1Text = h1s.first().text().trim().slice(0, 500) || null
      $('h1, h2, h3, h4, h5, h6').each((_, el) => {
        const tag = (el.tagName || '').toLowerCase()
        const level = Number(tag.replace('h', ''))
        if (!Number.isInteger(level) || level < 1 || level > 6) return
        const text = $(el).text().replace(/\s+/g, ' ').trim()
        if (!text) return
        headingsForJson.push({ level, text: text.slice(0, 500) })
      })

      const text = $('body').text().replace(/\s+/g, ' ').trim()
      wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0

      // Resolve href against finalUrl so root-relative (/path) and relative paths get a full URL + origin.
      $('a[href]').each((_, el) => {
        const href = $(el).attr('href')
        if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return
        const abs = normalizeUrl(href, finalUrl)
        if (!abs) return
        if (!shouldIncludeUrl(abs, cfg)) return
        let linkHost = ''
        try {
          linkHost = new URL(abs).hostname
        } catch {
          return
        }
        const internal = hostMatchesCrawlRoot(linkHost, startHostname)
        const canonical = internal ? rewriteInternalUrlToStartOrigin(abs, canonicalStart) : abs
        if (internal) internalLinks++
        else externalLinks++
        const rel = $(el).attr('rel') ?? ''
        const textContent = $(el).text().trim().slice(0, 200)
        linksForJson.push({ href: canonical, text: textContent, rel, isInternal: internal })
        if (internal && depth < cfg.maxDepth && shouldIncludeUrl(canonical, cfg)) {
          internalTargets.push(canonical)
        }
      })

      const robots = $('meta[name="robots"]').attr('content')?.toLowerCase() ?? ''
      const indexable = !robots.includes('noindex')

      const { hasSchema, schemaTypes, schemaJson } = extractJsonLdFromHtml($)

      const page = await prisma.crawledPage.create({
        data: {
          crawlSessionId,
          url,
          statusCode,
          contentType,
          indexable,
          crawlDepth: depth,
          responseTimeMs,
          htmlSize,
          title,
          titleLength: title?.length ?? null,
          metaDescription,
          metaDescLength: metaDescription?.length ?? null,
          h1Count,
          h1Text,
          headingsJson: JSON.stringify(headingsForJson.slice(0, 400)),
          internalLinks,
          externalLinks,
          linksJson: JSON.stringify(linksForJson.slice(0, 500)),
          wordCount,
          hasSchema,
          schemaTypes,
          schemaJson,
        },
      })

      const issues: { category: IssueCategory; severity: IssueSeverity; code: string; message: string; detail?: string }[] = []
      if (!title || title.length === 0) {
        issues.push({
          category: IssueCategory.CONTENT,
          severity: IssueSeverity.CRITICAL,
          code: 'MISSING_TITLE',
          message: 'Page has no title tag',
        })
      }
      if (wordCount !== null && wordCount < 300) {
        issues.push({
          category: IssueCategory.CONTENT,
          severity: IssueSeverity.WARNING,
          code: 'THIN_CONTENT',
          message: 'Content has fewer than 300 words',
          detail: `wordCount=${wordCount}`,
        })
      }
      for (const iss of issues) {
        await prisma.pageIssue.create({ data: { pageId: page.id, ...iss } })
      }

      pagesCrawled++

      if (followLinks) {
        for (const next of internalTargets) {
          if (pagesCrawled + queue.length >= cfg.maxPages && fetched.size >= cfg.maxPages) break
          if (!enqueued.has(next) && fetched.size < cfg.maxPages) {
            enqueued.add(next)
            queue.push({ url: next, depth: depth + 1 })
          }
        }
      }

      const dto: CrawledPageDTO = {
        id: page.id,
        url: page.url,
        statusCode: page.statusCode,
        contentType: page.contentType,
        title: page.title,
        titleLength: page.titleLength,
        metaDescription: page.metaDescription,
        wordCount: page.wordCount,
        indexable: page.indexable,
        crawlDepth: page.crawlDepth,
        responseTimeMs: page.responseTimeMs,
        hasSchema: page.hasSchema,
      }
      publish('crawl:page', dto)
      maybeEmitProgress()

      if (cfg.crawlDelay > 0) {
        await new Promise((r) => setTimeout(r, cfg.crawlDelay))
      }
    } else {
      await prisma.crawledPage.create({
        data: {
          crawlSessionId,
          url,
          statusCode,
          contentType,
          indexable: null,
          crawlDepth: depth,
          responseTimeMs,
          htmlSize,
        },
      })
      pagesCrawled++
      maybeEmitProgress()
    }
  }

  let inFlight = 0
  let settled = false
  let finishResolve!: () => void
  const finished = new Promise<void>((r) => {
    finishResolve = r
  })

  const safeResolve = () => {
    if (settled) return
    settled = true
    finishResolve()
  }

  const pump = () => {
    void (async () => {
      const status = await getStatus()
      if (status === CrawlStatus.CANCELLED) {
        if (inFlight === 0) safeResolve()
        return
      }
      if (status === CrawlStatus.PAUSED) {
        // Wait 2s then re-check, allowing in-flight requests to finish
        setTimeout(pump, 2000)
        return
      }

      while (inFlight < concurrency && queue.length > 0 && pagesCrawled < cfg.maxPages) {
        const peek = queue[0]
        if (!peek) break
        if (fetched.has(peek.url) || peek.depth > cfg.maxDepth) {
          queue.shift()
          continue
        }
        const item = queue.shift()!
        fetched.add(item.url)
        inFlight++
        fetchAndPersist(item.url, item.depth)
          .catch(() => {
            errors++
          })
          .finally(() => {
            inFlight--
            if (queue.length === 0 && inFlight === 0) {
              safeResolve()
              return
            }
            pump()
          })
      }

      if (queue.length === 0 && inFlight === 0) {
        safeResolve()
      }
    })()
  }

  try {
    pump()
    await finished
  } finally {
    if (browser) {
      await browser.close().catch(() => {})
      browser = null
    }
  }

  const cancelled = await isCancelled()
  const durationSec = (Date.now() - sessionStart) / 1000
  const pages = await prisma.crawledPage.findMany({
    where: { crawlSessionId },
    select: { responseTimeMs: true },
  })
  const withRt = pages.filter((p) => p.responseTimeMs != null)
  const avgResponseMs =
    withRt.length > 0 ? Math.round(withRt.reduce((s, p) => s + (p.responseTimeMs ?? 0), 0) / withRt.length) : 0

  const stats: CrawlStats = {
    totalPages: pagesCrawled,
    errors,
    durationSec,
    avgResponseMs,
  }

  await prisma.crawlSession.update({
    where: { id: crawlSessionId },
    data: {
      status: cancelled ? CrawlStatus.CANCELLED : CrawlStatus.COMPLETED,
      completedAt: new Date(),
      stats: JSON.stringify({
        totalPages: stats.totalPages,
        errors: stats.errors,
        duration: stats.durationSec,
        avgResponseMs: stats.avgResponseMs,
      }),
    },
  })

  publish('crawl:complete', stats)
}
