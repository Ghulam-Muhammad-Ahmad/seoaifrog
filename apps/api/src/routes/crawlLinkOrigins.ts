import type { CrawledPageLinkDTO, CrawledPageOriginDTO } from '@seoaifrog/shared'

type SourcePageLike = {
  url: string
  linksJson: string | null
}

function parseLinks(linksJson: string | null): CrawledPageLinkDTO[] {
  if (!linksJson) return []
  try {
    const parsed = JSON.parse(linksJson) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is CrawledPageLinkDTO =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as CrawledPageLinkDTO).href === 'string' &&
        typeof (item as CrawledPageLinkDTO).text === 'string' &&
        typeof (item as CrawledPageLinkDTO).rel === 'string',
    )
  } catch {
    return []
  }
}

export function findLinkedFromSources(targetUrl: string, pages: SourcePageLike[]): CrawledPageOriginDTO[] {
  const seen = new Set<string>()
  const linkedFrom: CrawledPageOriginDTO[] = []

  for (const page of pages) {
    for (const link of parseLinks(page.linksJson)) {
      if (link.href !== targetUrl) continue
      const key = `${page.url}\u0000${link.text}\u0000${link.rel}`
      if (seen.has(key)) continue
      seen.add(key)
      linkedFrom.push({
        url: page.url,
        text: link.text,
        rel: link.rel,
      })
    }
  }

  return linkedFrom
}
