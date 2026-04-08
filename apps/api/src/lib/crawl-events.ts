export const CRAWL_EVENTS_CHANNEL = 'crawl:events'

export type CrawlEventMessage = {
  crawlId: string
  type: 'crawl:page' | 'crawl:progress' | 'crawl:complete' | 'crawl:paused'
  data: unknown
}
