export interface ReportSection {
  skillName: string
  title: string
  score: number | null
  bodyMarkdown: string
}

export interface ReportDocument {
  meta: {
    domain: string
    rootUrl: string
    auditId: string
    generatedAt: string
    crawlStats: {
      totalPages: number
      crawlDuration: number
      errorCount: number
      avgResponseMs: number
    }
  }
  overallScore: number
  executiveSummary: string
  sections: ReportSection[]
  scoreBreakdown: Record<string, number>
}

export interface ReportDTO {
  id: string
  projectId: string
  auditId: string | null
  title: string
  format: string
  overallScore: number | null
  createdAt: string
  /** Inline markdown (preview / fetch) */
  downloadUrl?: string
  /** Attachment download */
  exportUrl?: string
}

/** POST /projects/:id/reports response */
export interface ReportCreatedDTO extends ReportDTO {
  markdown: string
}
