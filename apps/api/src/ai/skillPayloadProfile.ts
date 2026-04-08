import type { Prisma } from '@prisma/client'

export type SkillPayloadProfile = {
  maxPages: number
  select: Prisma.CrawledPageSelect
}

const BASE: Prisma.CrawledPageSelect = {
  id: true,
  url: true,
  statusCode: true,
  redirectUrl: true,
  contentType: true,
  indexable: true,
  crawlDepth: true,
  responseTimeMs: true,
  htmlSize: true,
  title: true,
  titleLength: true,
  metaDescription: true,
  metaDescLength: true,
  metaRobots: true,
  canonical: true,
  ogTitle: true,
  ogDescription: true,
  ogImage: true,
  h1Count: true,
  h1Text: true,
  internalLinks: true,
  externalLinks: true,
  wordCount: true,
  readabilityScore: true,
  hasSchema: true,
  schemaTypes: true,
  lcp: true,
  cls: true,
  ttfb: true,
  crawledAt: true,
}

/** No heavy text / JSON blobs — good for technical & TPM limits. */
const TECHNICAL: SkillPayloadProfile = {
  maxPages: 350,
  select: { ...BASE },
}

const CONTENT: SkillPayloadProfile = {
  maxPages: 100,
  select: { ...BASE, headingsJson: true },
}

const IMAGES: SkillPayloadProfile = {
  maxPages: 200,
  select: {
    ...BASE,
    imageCount: true,
    imagesMissingAlt: true,
    imagesJson: true,
  },
}

const SCHEMA: SkillPayloadProfile = {
  maxPages: 200,
  select: { ...BASE, schemaJson: true },
}

const HREFLANG: SkillPayloadProfile = {
  maxPages: 200,
  select: { ...BASE, hreflangJson: true },
}

const SITEMAP: SkillPayloadProfile = {
  maxPages: 200,
  select: { ...BASE, linksJson: true },
}

const PAGE_DEEP: SkillPayloadProfile = {
  maxPages: 40,
  select: {
    ...BASE,
    headingsJson: true,
    linksJson: true,
    imageCount: true,
    imagesMissingAlt: true,
    imagesJson: true,
    schemaJson: true,
    hreflangJson: true,
  },
}

const BY_SKILL: Record<string, SkillPayloadProfile> = {
  'seo-technical': TECHNICAL,
  'seo-performance': TECHNICAL,
  'seo-programmatic': TECHNICAL,
  'seo-plan': TECHNICAL,
  'seo-audit': TECHNICAL,
  'seo-competitor-pages': TECHNICAL,
  'seo-content': CONTENT,
  'seo-geo': CONTENT,
  'seo-images': IMAGES,
  'seo-schema': SCHEMA,
  'seo-hreflang': HREFLANG,
  'seo-sitemap': SITEMAP,
  'seo-page': PAGE_DEEP,
}

export function getSkillPayloadProfile(skillName: string): SkillPayloadProfile {
  return BY_SKILL[skillName] ?? TECHNICAL
}

export type PageForPayload = Record<string, unknown>

export function shrinkPageRowForSkill(skillName: string, row: PageForPayload): PageForPayload {
  const t = (s: unknown, max: number): unknown => {
    if (s == null || typeof s !== 'string') return s
    if (s.length <= max) return s
    return s.slice(0, max) + '…[truncated]'
  }

  const out = { ...row }

  if (typeof out.h1Text === 'string') out.h1Text = t(out.h1Text, 400)
  if (typeof out.metaDescription === 'string') out.metaDescription = t(out.metaDescription, 500)

  if (skillName === 'seo-content' || skillName === 'seo-geo' || skillName === 'seo-page') {
    out.headingsJson = t(out.headingsJson, skillName === 'seo-page' ? 6000 : 4500)
  }

  if (skillName === 'seo-images') {
    out.imagesJson = t(out.imagesJson, 12_000)
  }

  if (skillName === 'seo-schema' || skillName === 'seo-page') {
    out.schemaJson = t(out.schemaJson, skillName === 'seo-page' ? 10_000 : 14_000)
  }

  if (skillName === 'seo-hreflang' || skillName === 'seo-page') {
    out.hreflangJson = t(out.hreflangJson, skillName === 'seo-page' ? 6000 : 9000)
  }

  if (skillName === 'seo-sitemap' || skillName === 'seo-page') {
    out.linksJson = t(out.linksJson, skillName === 'seo-page' ? 8000 : 10_000)
  }

  return out
}
