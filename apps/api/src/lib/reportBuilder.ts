export type SpeedTestReportRow = {
  id: string
  url: string
  strategy: string
  fetchedAt: Date
  performanceScore: number | null
  accessibilityScore: number | null
  bestPracticesScore: number | null
  seoScore: number | null
  pwaScore: number | null
  firstContentfulPaintMs: number | null
  largestContentfulPaintMs: number | null
  cumulativeLayoutShift: number | null
  interactionToNextPaintMs: number | null
  totalBlockingTimeMs: number | null
  speedIndexMs: number | null
}

function msToSec(ms: number | null): string {
  if (ms == null) return '—'
  return `${(ms / 1000).toFixed(2)}s`
}

function fmtScore(n: number | null): string {
  return n == null ? '—' : String(n)
}

function scoreLabel(n: number | null): string {
  if (n == null) return ''
  if (n >= 90) return ' ✓'
  if (n >= 50) return ' ⚠'
  return ' ✗'
}

function cls(n: number | null): string {
  return n == null ? '—' : n.toFixed(3)
}

export function buildSpeedTestReportMarkdown(
  title: string,
  domain: string,
  tests: SpeedTestReportRow[],
): string {
  const lines: string[] = []
  lines.push(`# ${escapeMdHeading(title)}`, '')
  lines.push(`- **Domain:** ${domain}`)
  lines.push(`- **Report type:** PageSpeed / Core Web Vitals`)
  lines.push(`- **Tests included:** ${tests.length}`)
  lines.push(`- **Generated at:** ${new Date().toISOString()}`, '')
  lines.push('---', '')

  for (const t of tests) {
    lines.push(`## ${escapeMdHeading(t.url)}`, '')
    lines.push(`**Strategy:** ${t.strategy}  `)
    lines.push(`**Tested at:** ${t.fetchedAt.toISOString()}`, '')

    lines.push('### Scores', '')
    lines.push('| Category | Score | Rating |')
    lines.push('|---|---|---|')
    lines.push(`| Performance | ${fmtScore(t.performanceScore)} | ${scoreLabel(t.performanceScore)} |`)
    lines.push(`| Accessibility | ${fmtScore(t.accessibilityScore)} | ${scoreLabel(t.accessibilityScore)} |`)
    lines.push(`| Best Practices | ${fmtScore(t.bestPracticesScore)} | ${scoreLabel(t.bestPracticesScore)} |`)
    lines.push(`| SEO | ${fmtScore(t.seoScore)} | ${scoreLabel(t.seoScore)} |`)
    lines.push(`| PWA | ${fmtScore(t.pwaScore)} | ${scoreLabel(t.pwaScore)} |`)
    lines.push('')

    lines.push('### Core Web Vitals', '')
    lines.push('| Metric | Value |')
    lines.push('|---|---|')
    lines.push(`| First Contentful Paint (FCP) | ${msToSec(t.firstContentfulPaintMs)} |`)
    lines.push(`| Largest Contentful Paint (LCP) | ${msToSec(t.largestContentfulPaintMs)} |`)
    lines.push(`| Cumulative Layout Shift (CLS) | ${cls(t.cumulativeLayoutShift)} |`)
    lines.push(`| Interaction to Next Paint (INP) | ${msToSec(t.interactionToNextPaintMs)} |`)
    lines.push(`| Total Blocking Time (TBT) | ${msToSec(t.totalBlockingTimeMs)} |`)
    lines.push(`| Speed Index | ${msToSec(t.speedIndexMs)} |`)
    lines.push('')
    lines.push('---', '')
  }

  return lines.join('\n')
}

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
