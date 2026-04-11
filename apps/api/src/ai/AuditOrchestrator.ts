import type { PrismaClient } from '@prisma/client'
import { AuditStatus } from '@prisma/client'
import { ensureCrawlEmbeddings } from './embeddings/crawlEmbeddingService.js'
import { OpenAIClient } from './OpenAIClient.js'
import { buildPayloadForSkill, type SkillPayloadContext } from './PayloadBuilder.js'
import { decodeAuditSelection } from './auditSelection.js'
import { saveAuditReport } from '../lib/reportPersistence.js'
import { decryptUserSecret } from '../lib/accountCrypto.js'

const SKILL_GROUPS: string[][] = [
  ['seo-technical', 'seo-content', 'seo-images', 'seo-schema', 'seo-sitemap', 'seo-hreflang'],
  ['seo-geo', 'seo-page', 'seo-programmatic', 'seo-performance'],
  ['seo-competitor-pages', 'seo-audit', 'seo-plan'],
]

function computeOverall(scores: Map<string, number>): number | null {
  const weights: Record<string, number> = {
    'seo-technical': 0.25,
    'seo-content': 0.25,
    'seo-page': 0.2,
    'seo-schema': 0.1,
    'seo-performance': 0.1,
    'seo-images': 0.05,
    'seo-geo': 0.05,
  }
  let sum = 0
  let w = 0
  for (const [k, wt] of Object.entries(weights)) {
    const s = scores.get(k)
    if (s != null) {
      sum += s * wt
      w += wt
    }
  }
  if (w === 0) {
    const vals = [...scores.values()]
    if (vals.length === 0) return null
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
  }
  return Math.round(sum / w)
}

export async function runAuditOrchestrator(prisma: PrismaClient, auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      project: {
        include: {
          user: { select: { openaiApiKeyEnc: true } },
        },
      },
    },
  })
  if (!audit) return

  const enc = audit.project.user.openaiApiKeyEnc
  if (!enc) throw new Error('OpenAI API key is not configured for this account')
  const master = process.env.ACCOUNT_ENCRYPTION_KEY?.trim()
  if (!master) throw new Error('Server encryption is not configured')

  let userOpenAiKey: string
  try {
    userOpenAiKey = decryptUserSecret(enc, master)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Could not read saved OpenAI API key: ${msg}`)
  }

  const selection = decodeAuditSelection(audit.skillsSelected)
  const skills = selection.skills

  const ctx: SkillPayloadContext = {
    projectId: audit.projectId,
    project: {
      name: audit.project.name,
      domain: audit.project.domain,
      rootUrl: audit.project.rootUrl,
    },
    crawlSessionId: audit.crawlSessionId,
    targetUrl: selection.targetUrl,
    openAiApiKey: userOpenAiKey,
  }

  if (audit.crawlSessionId) {
    await ensureCrawlEmbeddings(prisma, audit.crawlSessionId, audit.projectId, userOpenAiKey)
  }

  const client = new OpenAIClient(userOpenAiKey)
  const scores = new Map<string, number>()
  const isCancelled = async (): Promise<boolean> => {
    const a = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { status: true, errorMessage: true },
    })
    if (!a) return true
    return a.status === AuditStatus.FAILED && a.errorMessage === 'Cancelled by user'
  }

  for (const group of SKILL_GROUPS) {
    if (await isCancelled()) return
    const toRun = group.filter((s) => skills.includes(s))
    await Promise.all(
      toRun.map(async (skillName) => {
        if (await isCancelled()) return
        const row = await prisma.skillResult.findFirst({
          where: { auditId, skillName },
        })
        if (!row) return

        await prisma.skillResult.update({
          where: { id: row.id },
          data: { status: 'running' },
        })

        try {
          if (await isCancelled()) return
          const payload = await buildPayloadForSkill(prisma, skillName, ctx)
          const websiteUrl = selection.targetUrl ?? audit.project.rootUrl
          const out = await client.completeWithSkill(skillName, payload, websiteUrl)
          if (out.score != null) scores.set(skillName, out.score)

          await prisma.skillResult.update({
            where: { id: row.id },
            data: {
              status: 'completed',
              score: out.score,
              rawResponse: out.rawResponse,
              tokensUsed: out.tokensUsed,
              durationMs: out.durationMs,
              completedAt: new Date(),
            },
          })
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          await prisma.skillResult.update({
            where: { id: row.id },
            data: {
              status: 'failed',
              rawResponse: msg,
              completedAt: new Date(),
            },
          })
        }
      }),
    )
  }

  if (await isCancelled()) return
  const overall = computeOverall(scores)
  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: AuditStatus.COMPLETED,
      overallScore: overall,
      completedAt: new Date(),
    },
  })

  try {
    await saveAuditReport(prisma, auditId)
  } catch (e) {
    // Do not fail a completed audit if report file persistence has transient issues.
    console.error('failed to persist audit report', auditId, e)
  }
}
