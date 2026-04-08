import got from 'got'

export interface CollectSitemapUrlsOptions {
  userAgent: string
  /** Max HTTP fetches for sitemap documents (indexes + nested). */
  maxSitemapFetches: number
  /** Stop after collecting this many page URLs. */
  maxPageUrls: number
}

function normalizeLoc(href: string, base?: string): string | null {
  try {
    const u = new URL(href.trim(), base)
    u.hash = ''
    return u.href
  } catch {
    return null
  }
}

function stripCdata(inner: string): string {
  const m = inner.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/)
  return (m ? m[1] : inner).trim()
}

function extractEntryBlocks(body: string, tag: 'url' | 'sitemap'): string[] {
  const out: string[] = []
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`, 'gi')
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const block = (m[1] ?? '').trim()
    if (block) out.push(block)
  }
  return out
}

/**
 * Extract one primary <loc> from a <url> or <sitemap> entry.
 * Intentionally ignores media/alternate namespaces like image:loc, video:loc, xhtml:link.
 */
function extractPrimaryLocFromEntry(entryXml: string): string | null {
  const plain = entryXml.match(/<loc\b[^>]*>([\s\S]*?)<\/loc>/i)
  if (plain?.[1]) {
    const t = stripCdata(plain[1].trim())
    return t || null
  }

  const prefixed = entryXml.match(
    /<(?:(?!(?:image|video|news|xhtml):)[\w.-]+:)?loc\b[^>]*>([\s\S]*?)<\/(?:(?!(?:image|video|news|xhtml):)[\w.-]+:)?loc>/i,
  )
  if (prefixed?.[1]) {
    const t = stripCdata(prefixed[1].trim())
    return t || null
  }
  return null
}

function parseSitemapBody(body: string, documentUrl: string): { pageUrls: string[]; childSitemaps: string[] } {
  const head = body.slice(0, 4000)
  const isIndex = /<[^:>\s]*:?sitemapindex[\s>]/i.test(head)

  const pageUrls: string[] = []
  const childSitemaps: string[] = []

  const entries = isIndex ? extractEntryBlocks(body, 'sitemap') : extractEntryBlocks(body, 'url')
  for (const entry of entries) {
    const loc = extractPrimaryLocFromEntry(entry)
    if (!loc) continue
    const abs = normalizeLoc(loc, documentUrl)
    if (!abs) continue
    if (isIndex) childSitemaps.push(abs)
    else pageUrls.push(abs)
  }

  return { pageUrls, childSitemaps }
}

async function fetchSitemapBody(url: string, userAgent: string): Promise<string | null> {
  try {
    const res = await got(url, {
      headers: { 'user-agent': userAgent },
      timeout: { request: 120_000 },
      throwHttpErrors: false,
      retry: { limit: 1 },
      decompress: true,
    })
    if (res.statusCode !== 200 || !res.body) return null
    return res.body
  } catch {
    return null
  }
}

/**
 * Entry-point sitemap URLs: robots.txt Sitemap: lines, else common paths on origin.
 */
export async function discoverSitemapEntryPoints(siteUrl: string, userAgent: string): Promise<string[]> {
  let origin: string
  try {
    origin = new URL(siteUrl).origin
  } catch {
    return []
  }

  const found: string[] = []

  try {
    const robots = await got(`${origin}/robots.txt`, {
      headers: { 'user-agent': userAgent },
      timeout: { request: 20_000 },
      throwHttpErrors: false,
      retry: { limit: 1 },
    })
    if (robots.statusCode === 200 && robots.body) {
      for (const line of robots.body.split(/\n/)) {
        const m = line.trim().match(/^Sitemap:\s*(.+)$/i)
        if (m?.[1]) {
          const u = normalizeLoc(m[1].trim())
          if (u) found.push(u)
        }
      }
    }
  } catch {
    /* ignore */
  }

  if (found.length > 0) return [...new Set(found)]

  for (const path of ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml']) {
    const u = `${origin}${path}`
    const body = await fetchSitemapBody(u, userAgent)
    if (!body) continue
    const head = body.slice(0, 500).toLowerCase()
    if (head.includes('<urlset') || head.includes('sitemapindex') || head.includes('<url>')) {
      found.push(u)
      break
    }
  }

  return [...new Set(found)]
}

/**
 * Follow sitemap indexes and collect unique page loc URLs (order preserved).
 */
export async function collectPageUrlsFromSitemaps(
  entryPoints: string[],
  opts: CollectSitemapUrlsOptions,
): Promise<string[]> {
  const seenPageCandidates = new Set<string>()
  const pageBuckets: string[][] = []
  const queue = [...entryPoints]
  const seenQueued = new Set<string>(entryPoints.map((u) => u))
  let fetches = 0

  const pushChild = (u: string) => {
    if (seenQueued.has(u) || queue.length + fetches > opts.maxSitemapFetches * 2) return
    seenQueued.add(u)
    queue.push(u)
  }

  while (queue.length > 0 && fetches < opts.maxSitemapFetches) {
    const url = queue.shift()!
    fetches++
    const body = await fetchSitemapBody(url, opts.userAgent)
    if (!body) continue

    const { pageUrls: pages, childSitemaps } = parseSitemapBody(body, url)
    for (const s of childSitemaps) {
      const n = normalizeLoc(s, url)
      if (n) pushChild(n)
    }
    const bucket: string[] = []
    for (const p of pages) {
      const n = normalizeLoc(p, url)
      if (!n || seenPageCandidates.has(n)) continue
      seenPageCandidates.add(n)
      bucket.push(n)
    }
    if (bucket.length > 0) {
      pageBuckets.push(bucket)
    }
  }

  if (pageBuckets.length === 0) return []

  // Round-robin across sitemap documents so one huge sitemap does not starve others.
  const pageUrls: string[] = []
  const bucketIndex = new Array<number>(pageBuckets.length).fill(0)
  while (pageUrls.length < opts.maxPageUrls) {
    let progressed = false
    for (let i = 0; i < pageBuckets.length; i++) {
      const idx = bucketIndex[i]
      const bucket = pageBuckets[i]
      if (idx >= bucket.length) continue
      pageUrls.push(bucket[idx]!)
      bucketIndex[i] = idx + 1
      progressed = true
      if (pageUrls.length >= opts.maxPageUrls) break
    }
    if (!progressed) break
  }

  return pageUrls
}
