import type { CrawlSession } from '@prisma/client'

export function serializeCrawlSession(
  session: CrawlSession,
  totalPagesInCrawl: number,
  pagesInSample: number,
  maxPagesCap: number,
) {
  let config: unknown = session.config
  try {
    config = JSON.parse(session.config) as unknown
  } catch {
    /* keep raw string */
  }
  let stats: unknown = null
  if (session.stats) {
    try {
      stats = JSON.parse(session.stats) as unknown
    } catch {
      stats = session.stats
    }
  }
  return {
    id: session.id,
    projectId: session.projectId,
    status: session.status,
    config,
    stats,
    startedAt: session.startedAt?.toISOString() ?? null,
    completedAt: session.completedAt?.toISOString() ?? null,
    errorMessage: session.errorMessage,
    createdAt: session.createdAt.toISOString(),
    totalPagesInCrawl,
    pagesIncludedInPayload: pagesInSample,
    maxPagesCap,
  }
}
