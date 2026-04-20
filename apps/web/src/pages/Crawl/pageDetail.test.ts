import test from 'node:test'
import assert from 'node:assert/strict'
import type { CrawledPageDetailDTO } from '@seoaifrog/shared'
import { normalizeCrawledPageDetail } from './pageDetail.js'

test('normalizeCrawledPageDetail fills missing runtime arrays with empty arrays', () => {
  const raw = {
    id: 'page-1',
    url: 'https://example.com/page',
    statusCode: 200,
    contentType: 'text/html',
    indexable: true,
    crawlDepth: 1,
    responseTimeMs: 150,
    htmlSize: 12000,
    title: 'Example',
    titleLength: 7,
    metaDescription: null,
    metaDescLength: null,
    ogTitle: null,
    ogDescription: null,
    ogImage: null,
    h1Count: 1,
    h2Count: 0,
    h1Text: 'Example',
    internalLinks: 2,
    externalLinks: 1,
    wordCount: 450,
    crawledAt: '2026-04-17T00:00:00.000Z',
    hasSchema: false,
    schemaTypes: null,
    schemaJson: null,
  } as Partial<CrawledPageDetailDTO>

  const detail = normalizeCrawledPageDetail(raw)

  assert.deepEqual(detail.links, [])
  assert.deepEqual(detail.headings, [])
  assert.deepEqual(detail.linkedFrom, [])
  assert.deepEqual(detail.issues, [])
})
