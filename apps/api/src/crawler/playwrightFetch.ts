import type { Browser } from 'playwright'
import type { CrawlConfig } from '@seoaifrog/shared'

export type FetchedDocument = {
  statusCode: number
  body: string
  contentType: string | null
  /** After redirects — use as base URL for resolving relative links in the DOM. */
  finalUrl: string
}

/**
 * Load URL in a real browser and return rendered HTML (for SPAs).
 * Caller must create pages from a shared Browser; one page per concurrent fetch.
 */
export async function fetchHtmlWithPlaywright(
  browser: Browser,
  url: string,
  cfg: CrawlConfig,
): Promise<FetchedDocument> {
  const page = await browser.newPage()
  const navTimeout = Math.min(120_000, 45_000 + Math.max(0, cfg.jsWaitMs))
  try {
    await page.setExtraHTTPHeaders({ 'user-agent': cfg.userAgent })
    const resp = await page.goto(url, {
      // `load` waits for deferred scripts; many SPAs need this (not just domcontentloaded).
      waitUntil: 'load',
      timeout: navTimeout,
    })
    const statusCode = resp?.status() ?? 0
    const headers = resp?.headers() ?? {}
    const ctRaw = headers['content-type'] ?? headers['Content-Type']
    const contentType = typeof ctRaw === 'string' ? ctRaw.split(';')[0]?.trim() ?? null : null

    if (cfg.jsWaitMs > 0) {
      await new Promise((r) => setTimeout(r, cfg.jsWaitMs))
    }

    const body = await page.content()
    const finalUrl = page.url()
    return { statusCode, body, contentType, finalUrl }
  } finally {
    await page.close()
  }
}
