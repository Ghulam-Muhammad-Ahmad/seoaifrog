export type ReportSkillRow = {
  skillName: string
  status: string
  score: number | null
  rawResponse: string | null
}

export type ReportSpeedRow = {
  url: string
  strategy: string
  fetchedAt: Date
  performanceScore: number | null
  accessibilityScore: number | null
  bestPracticesScore: number | null
  seoScore: number | null
  pwaScore: number | null
  largestContentfulPaintMs: number | null
  cumulativeLayoutShift: number | null
  interactionToNextPaintMs: number | null
}

function escapeMdHeading(s: string): string {
  return s.replace(/#/g, '\\#').replace(/\n/g, ' ')
}

export function buildReportMarkdown(
  title: string,
  domain: string,
  overallScore: number | null,
  skillResults: ReportSkillRow[],
  speedRows: ReportSpeedRow[] = [],
): string {
  const lines: string[] = []
  lines.push(`# ${escapeMdHeading(title)}`, '')
  lines.push(`- **Domain:** ${domain}`)
  lines.push(`- **Overall score:** ${overallScore ?? '—'}`, '')
  lines.push('---', '')

  if (speedRows.length > 0) {
    lines.push('## PageSpeed Insights', '')
    lines.push('Recent saved tests (user-triggered):', '')
    for (const r of speedRows.slice(0, 5)) {
      lines.push(`### ${escapeMdHeading(r.url)} (${r.strategy})`, '')
      lines.push(`- Fetched at: ${r.fetchedAt.toISOString()}`)
      lines.push(`- Performance: ${r.performanceScore ?? '—'}`)
      lines.push(`- Accessibility: ${r.accessibilityScore ?? '—'}`)
      lines.push(`- Best practices: ${r.bestPracticesScore ?? '—'}`)
      lines.push(`- SEO: ${r.seoScore ?? '—'}`)
      lines.push(`- PWA: ${r.pwaScore ?? '—'}`)
      lines.push(`- LCP (ms): ${r.largestContentfulPaintMs ?? '—'}`)
      lines.push(`- CLS: ${r.cumulativeLayoutShift ?? '—'}`)
      lines.push(`- INP (ms): ${r.interactionToNextPaintMs ?? '—'}`, '')
    }
    lines.push('---', '')
  }

  const sorted = [...skillResults].sort((a, b) => a.skillName.localeCompare(b.skillName))
  for (const s of sorted) {
    lines.push(`## ${escapeMdHeading(s.skillName)}`, '')
    lines.push(`**Score:** ${s.score ?? '—'}  `)
    lines.push(`**Status:** ${s.status}`, '')
    const body = (s.rawResponse ?? s.status).trim()
    if (body) {
      lines.push('')
      lines.push(body)
      lines.push('')
    }
  }

  return lines.join('\n')
}
