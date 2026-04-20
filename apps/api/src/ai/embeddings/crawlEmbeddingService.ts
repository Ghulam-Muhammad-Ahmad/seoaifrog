import type { CrawlSession, Prisma, PrismaClient } from '@prisma/client'
import OpenAI from 'openai'
import type { SkillPayloadContext } from '../PayloadBuilder.js'
import { serializeCrawlSession } from '../crawlSessionSerialize.js'
import { chunkPageText } from './chunkText.js'
import { skillRetrievalQueryFor } from './skillRetrievalQueries.js'
import { OpenAIEmbeddings } from '../OpenAIEmbeddings.js'

const BATCH_EMBED = 64
const INSERT_BATCH = 40

export function embeddingAuditEnabled(): boolean {
  const v = process.env.AUDIT_USE_EMBEDDINGS
  if (v === '0' || v === 'false' || v === 'off') return false
  return true
}

function forceEmbeddingRefresh(): boolean {
  const v = process.env.AUDIT_EMBEDDING_REFRESH
  return v === '1' || v === 'true' || v === 'on'
}

function toVec(j: unknown): number[] | null {
  if (!Array.isArray(j)) return null
  if (!j.every((x) => typeof x === 'number')) return null
  return j as number[]
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  const d = Math.sqrt(na) * Math.sqrt(nb)
  return d === 0 ? 0 : dot / d
}

function histogram(codes: (number | null)[]): Record<string, number> {
  const h: Record<string, number> = {}
  for (const c of codes) {
    const k = String(c ?? 'unknown')
    h[k] = (h[k] ?? 0) + 1
  }
  return h
}

/**
 * Chunk crawled page text, embed with OpenAI, persist vectors. Call once per audit (before skills).
 */
export async function ensureCrawlEmbeddings(
  prisma: PrismaClient,
  crawlSessionId: string,
  projectId: string,
  apiKey: string,
): Promise<void> {
  if (!embeddingAuditEnabled()) return

  const key = apiKey.trim()
  if (!key) throw new Error('OpenAI API key is required for AUDIT_USE_EMBEDDINGS')

  const session = await prisma.crawlSession.findFirst({
    where: { id: crawlSessionId, projectId },
  })
  if (!session) return

  const pageCount = await prisma.crawledPage.count({ where: { crawlSessionId } })
  const chunkRows = await prisma.crawlTextChunk.count({ where: { crawlSessionId } })

  if (
    !forceEmbeddingRefresh() &&
    chunkRows > 0 &&
    session.embeddingPageCount === pageCount &&
    pageCount > 0
  ) {
    return
  }

  await prisma.crawlTextChunk.deleteMany({ where: { crawlSessionId } })

  const model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small'

  if (pageCount === 0) {
    await prisma.crawlSession.update({
      where: { id: crawlSessionId },
      data: { embeddingPageCount: 0, embeddingModel: null },
    })
    return
  }

  const pages = await prisma.crawledPage.findMany({
    where: { crawlSessionId },
    select: { id: true, url: true, title: true },
    orderBy: { crawledAt: 'asc' },
  })

  type Row = { pageId: string; url: string; chunkIndex: number; text: string }
  const work: Row[] = []
  for (const p of pages) {
    const parts = chunkPageText(p.title, null)
    for (let i = 0; i < parts.length; i++) {
      work.push({ pageId: p.id, url: p.url, chunkIndex: i, text: parts[i] })
    }
  }

  const openai = new OpenAI({ apiKey: key })
  const emb = new OpenAIEmbeddings(openai)

  if (work.length === 0) {
    await prisma.crawlSession.update({
      where: { id: crawlSessionId },
      data: { embeddingPageCount: pageCount, embeddingModel: model },
    })
    return
  }

  const vectors: number[][] = []
  for (let i = 0; i < work.length; i += BATCH_EMBED) {
    const batch = work.slice(i, i + BATCH_EMBED)
    const vecs = await emb.embedBatch(batch.map((b) => b.text))
    if (vecs.length !== batch.length) {
      throw new Error(`Embedding batch size mismatch: expected ${batch.length}, got ${vecs.length}`)
    }
    vectors.push(...vecs)
  }

  for (let i = 0; i < work.length; i += INSERT_BATCH) {
    const slice = work.slice(i, i + INSERT_BATCH)
    const data = slice.map((row, offset) => ({
      crawlSessionId,
      pageId: row.pageId,
      url: row.url,
      chunkIndex: row.chunkIndex,
      text: row.text,
      embedding: vectors[i + offset] as unknown as Prisma.InputJsonValue,
    }))
    await prisma.crawlTextChunk.createMany({ data })
  }

  await prisma.crawlSession.update({
    where: { id: crawlSessionId },
    data: { embeddingPageCount: pageCount, embeddingModel: model },
  })
}

const PAGE_CTX_SELECT = {
  url: true,
  statusCode: true,
  title: true,
  wordCount: true,
  indexable: true,
  canonical: true,
  metaRobots: true,
  internalLinks: true,
  externalLinks: true,
  h1Count: true,
  hasSchema: true,
  schemaTypes: true,
  ttfb: true,
  lcp: true,
  cls: true,
  responseTimeMs: true,
  htmlSize: true,
} as const

export async function buildEmbeddingRetrievalPayload(
  prisma: PrismaClient,
  skillName: string,
  ctx: SkillPayloadContext,
  session: CrawlSession,
  totalPagesInCrawl: number,
  speedTests: unknown[] = [],
): Promise<string> {
  const key = (ctx.openAiApiKey ?? '').trim()
  if (!key) throw new Error('OpenAI API key is required for embedding retrieval')

  const topK = Math.min(
    80,
    Math.max(8, parseInt(process.env.AUDIT_EMBEDDING_TOP_K ?? '32', 10) || 32),
  )
  const queryText = skillRetrievalQueryFor(skillName)
  const model = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small'

  const openai = new OpenAI({ apiKey: key })
  const emb = new OpenAIEmbeddings(openai)
  const qVec = await emb.embedQuery(queryText)

  const stored = await prisma.crawlTextChunk.findMany({
    where: { crawlSessionId: ctx.crawlSessionId! },
    select: { pageId: true, url: true, chunkIndex: true, text: true, embedding: true },
  })

  const scored = stored
    .map((row) => {
      const v = toVec(row.embedding)
      if (!v) return null
      return {
        pageId: row.pageId,
        url: row.url,
        chunkIndex: row.chunkIndex,
        text: row.text.length > 4500 ? row.text.slice(0, 4500) + '…[truncated]' : row.text,
        similarity: cosineSimilarity(qVec, v),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x != null)

  scored.sort((a, b) => b.similarity - a.similarity)
  const top = scored.slice(0, topK)

  const pageIds = [...new Set(top.map((t) => t.pageId))]
  const pageMetas =
    pageIds.length === 0
      ? []
      : await prisma.crawledPage.findMany({
          where: { id: { in: pageIds } },
          select: PAGE_CTX_SELECT,
        })

  const statusRows = await prisma.crawledPage.findMany({
    where: { crawlSessionId: ctx.crawlSessionId! },
    select: { statusCode: true },
  })
  const statusHistogram = histogram(statusRows.map((r) => r.statusCode))

  const thin = await prisma.crawledPage.findMany({
    where: { crawlSessionId: ctx.crawlSessionId! },
    select: { url: true, wordCount: true, title: true },
  })
  const lowWordCount = thin
    .filter((p) => (p.wordCount ?? 0) < 300)
    .slice(0, 60)
    .map((p) => ({ url: p.url, wordCount: p.wordCount }))
  const missingTitle = thin.filter((p) => !p.title).slice(0, 60).map((p) => p.url)
  const crawlSession = serializeCrawlSession(session, totalPagesInCrawl, top.length, topK)

  const payload = {
    dataSource: 'embedding_retrieval',
    skillName,
    projectId: ctx.projectId,
    project: ctx.project,
    embeddingModel: model,
    retrievalQuery: queryText,
    topK,
    crawlSession,
    aggregateCrawlStats: {
      totalPagesInCrawl,
      statusHistogram,
      lowWordCount,
      missingTitle,
    },
    retrievedChunks: top.map(({ similarity, ...rest }) => ({
      ...rest,
      similarity: Math.round(similarity * 1000) / 1000,
    })),
    pageMetadataForRetrievedPages: pageMetas,
    speedTests,
  }

  return JSON.stringify(payload, null, 2)
}
