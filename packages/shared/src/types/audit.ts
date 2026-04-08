export type AuditStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED'

export interface SkillResultDTO {
  id: string
  skillName: string
  status: string
  score: number | null
  preview?: string
  rawResponse?: string
  durationMs?: number | null
}

export interface AuditDTO {
  id: string
  projectId: string
  crawlSessionId: string | null
  targetUrl: string | null
  status: AuditStatus
  skillsSelected: string[]
  overallScore: number | null
  skillResults: SkillResultDTO[]
  createdAt: string
  completedAt: string | null
  errorMessage: string | null
}

export const SKILL_IDS = [
  'seo-technical',
  'seo-content',
  'seo-images',
  'seo-schema',
  'seo-sitemap',
  'seo-hreflang',
  'seo-geo',
  'seo-page',
  'seo-plan',
  'seo-programmatic',
  'seo-competitor-pages',
  'seo-audit',
  'seo-performance',
] as const

export type SkillId = (typeof SKILL_IDS)[number]

export const SKILL_PRESETS = {
  full: [...SKILL_IDS],
  technical: ['seo-technical', 'seo-sitemap', 'seo-schema', 'seo-hreflang'] as const,
  content: ['seo-content', 'seo-page', 'seo-images', 'seo-geo'] as const,
  quick: ['seo-technical', 'seo-content'] as const,
} as const
