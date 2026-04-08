export interface CrawlConfig {
  startUrl: string
  maxPages: number
  maxDepth: number
  concurrency: number
  crawlDelay: number
  userAgent: string
  respectRobots: boolean
  renderJs: boolean
  jsWaitMs: number
  followRedirects: boolean
  includeNoindex: boolean
  urlFilters: {
    includePatterns: string[]
    excludePatterns: string[]
  }
  maxFileSize: number
  /** When true, discover sitemap(s) from the start URL’s origin, collect URL entries, and fetch only those (no link following). */
  crawlFromSitemapOnly: boolean
  /** If set (with crawlFromSitemapOnly), use this sitemap or index URL only instead of robots.txt / default paths. */
  sitemapUrl: string
}

export const defaultCrawlConfig: CrawlConfig = {
  startUrl: '',
  maxPages: 500,
  maxDepth: 10,
  concurrency: 5,
  crawlDelay: 100,
  userAgent: 'SEOAiFrog/1.0',
  respectRobots: true,
  renderJs: false,
  jsWaitMs: 2000,
  followRedirects: true,
  includeNoindex: true,
  urlFilters: { includePatterns: [], excludePatterns: [] },
  maxFileSize: 5 * 1024 * 1024,
  crawlFromSitemapOnly: false,
  sitemapUrl: '',
}

export interface CrawledPageDTO {
  id: string
  url: string
  statusCode: number | null
  contentType: string | null
  title: string | null
  titleLength: number | null
  metaDescription: string | null
  wordCount: number | null
  indexable: boolean | null
  crawlDepth: number
  responseTimeMs: number | null
  /** True when at least one valid application/ld+json block was parsed */
  hasSchema: boolean | null
}

export interface CrawledPageLinkDTO {
  href: string
  text: string
  rel: string
  isInternal: boolean
}

export interface CrawledPageIssueDTO {
  code: string
  message: string
  severity: string
  category: string
  detail: string | null
}

export interface CrawledPageHeadingDTO {
  level: number
  text: string
}

/** Full row + parsed links + issues (single-page crawl API). */
export interface CrawledPageDetailDTO {
  id: string
  url: string
  statusCode: number | null
  contentType: string | null
  indexable: boolean | null
  crawlDepth: number
  responseTimeMs: number | null
  htmlSize: number | null
  title: string | null
  titleLength: number | null
  metaDescription: string | null
  metaDescLength: number | null
  h1Count: number | null
  h2Count: number | null
  h1Text: string | null
  internalLinks: number | null
  externalLinks: number | null
  links: CrawledPageLinkDTO[]
  headings: CrawledPageHeadingDTO[]
  wordCount: number | null
  crawledAt: string
  hasSchema: boolean | null
  schemaTypes: string | null
  schemaJson: string | null
  issues: CrawledPageIssueDTO[]
}

export interface CrawlProgress {
  crawled: number
  queued: number
  errors: number
  pagesPerSec: number
}

export interface CrawlStats {
  totalPages: number
  errors: number
  durationSec: number
  avgResponseMs: number
}

export interface IssueDTO {
  id: string
  pageId: string
  category: string
  severity: string
  code: string
  message: string
  detail: string | null
  pageUrl?: string
}
