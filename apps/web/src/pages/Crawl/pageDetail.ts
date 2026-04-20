import type {
  CrawledPageDetailDTO,
  CrawledPageHeadingDTO,
  CrawledPageIssueDTO,
  CrawledPageLinkDTO,
  CrawledPageOriginDTO,
} from '@seoaifrog/shared'

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

export function normalizeCrawledPageDetail(
  detail: Partial<CrawledPageDetailDTO> | null | undefined,
): CrawledPageDetailDTO {
  return {
    id: detail?.id ?? '',
    url: detail?.url ?? '',
    statusCode: detail?.statusCode ?? null,
    contentType: detail?.contentType ?? null,
    indexable: detail?.indexable ?? null,
    crawlDepth: detail?.crawlDepth ?? 0,
    responseTimeMs: detail?.responseTimeMs ?? null,
    htmlSize: detail?.htmlSize ?? null,
    title: detail?.title ?? null,
    titleLength: detail?.titleLength ?? null,
    metaDescription: detail?.metaDescription ?? null,
    metaDescLength: detail?.metaDescLength ?? null,
    ogTitle: detail?.ogTitle ?? null,
    ogDescription: detail?.ogDescription ?? null,
    ogImage: detail?.ogImage ?? null,
    h1Count: detail?.h1Count ?? null,
    h2Count: detail?.h2Count ?? null,
    h1Text: detail?.h1Text ?? null,
    internalLinks: detail?.internalLinks ?? null,
    externalLinks: detail?.externalLinks ?? null,
    links: asArray<CrawledPageLinkDTO>(detail?.links),
    headings: asArray<CrawledPageHeadingDTO>(detail?.headings),
    wordCount: detail?.wordCount ?? null,
    crawledAt: detail?.crawledAt ?? '',
    hasSchema: detail?.hasSchema ?? null,
    schemaTypes: detail?.schemaTypes ?? null,
    schemaJson: detail?.schemaJson ?? null,
    linkedFrom: asArray<CrawledPageOriginDTO>(detail?.linkedFrom),
    issues: asArray<CrawledPageIssueDTO>(detail?.issues),
  }
}
