import got from 'got'

export type PageSpeedStrategy = 'mobile' | 'desktop'

export type PageSpeedRunInput = {
  url: string
  strategy: PageSpeedStrategy
  accessToken: string
}

export type PageSpeedMetrics = {
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
  fetchedAt: string
  finalUrl: string | null
  rawJson: unknown
}

type PsiError = Error & { code?: string; statusCode?: number }

function toNullableScore(v: unknown): number | null {
  if (typeof v !== 'number' || Number.isNaN(v)) return null
  return Math.round(v * 100)
}

function toNullableNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function pickAuditNumeric(lhr: unknown, key: string): number | null {
  if (!lhr || typeof lhr !== 'object') return null
  const audits = (lhr as { audits?: Record<string, unknown> }).audits
  const entry = audits?.[key]
  if (!entry || typeof entry !== 'object') return null
  return toNullableNumber((entry as { numericValue?: unknown }).numericValue)
}

function mapError(err: unknown): never {
  const e = err as PsiError & { response?: { body?: unknown } }
  const statusCode = typeof e.statusCode === 'number' ? e.statusCode : 500
  const body = e.response?.body
  let message = 'PageSpeed request failed'
  if (statusCode === 401 || statusCode === 403) {
    message = 'Google OAuth token is invalid or missing required permissions'
  } else if (statusCode === 429) {
    message = 'PageSpeed quota exceeded, please try again later'
  } else if (statusCode === 400) {
    message = 'Invalid URL or parameters for PageSpeed test'
  } else if (body && typeof body === 'object') {
    const b = body as { error?: { message?: unknown } }
    if (typeof b.error?.message === 'string' && b.error.message.trim()) {
      message = b.error.message
    }
  }
  const mapped = new Error(message) as PsiError
  mapped.statusCode = statusCode
  throw mapped
}

export async function runPageSpeed(input: PageSpeedRunInput): Promise<PageSpeedMetrics> {
  const params = new URLSearchParams()
  params.set('url', input.url)
  params.set('strategy', input.strategy)
  params.append('category', 'performance')
  params.append('category', 'accessibility')
  params.append('category', 'best-practices')
  params.append('category', 'seo')
  params.append('category', 'pwa')

  const response = await got
    .get('https://www.googleapis.com/pagespeedonline/v5/runPagespeed', {
      searchParams: params,
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
      },
      responseType: 'json',
      timeout: { request: 30_000 },
      throwHttpErrors: true,
    })
    .catch(mapError)

  const body = response.body as {
    analysisUTCTimestamp?: unknown
    lighthouseResult?: {
      requestedUrl?: unknown
      finalUrl?: unknown
      categories?: Record<string, { score?: unknown }>
      audits?: Record<string, { numericValue?: unknown }>
    }
  }

  const lhr = body?.lighthouseResult
  const categories = lhr?.categories ?? {}
  const fetchedAtRaw = body?.analysisUTCTimestamp
  const fetchedAt =
    typeof fetchedAtRaw === 'string' && fetchedAtRaw.trim().length > 0
      ? fetchedAtRaw
      : new Date().toISOString()

  return {
    performanceScore: toNullableScore(categories.performance?.score),
    accessibilityScore: toNullableScore(categories.accessibility?.score),
    bestPracticesScore: toNullableScore(categories['best-practices']?.score),
    seoScore: toNullableScore(categories.seo?.score),
    pwaScore: toNullableScore(categories.pwa?.score),
    firstContentfulPaintMs: pickAuditNumeric(lhr, 'first-contentful-paint'),
    largestContentfulPaintMs: pickAuditNumeric(lhr, 'largest-contentful-paint'),
    cumulativeLayoutShift: pickAuditNumeric(lhr, 'cumulative-layout-shift'),
    interactionToNextPaintMs: pickAuditNumeric(lhr, 'interaction-to-next-paint'),
    totalBlockingTimeMs: pickAuditNumeric(lhr, 'total-blocking-time'),
    speedIndexMs: pickAuditNumeric(lhr, 'speed-index'),
    fetchedAt,
    finalUrl: typeof lhr?.finalUrl === 'string' ? lhr.finalUrl : null,
    rawJson: body,
  }
}
