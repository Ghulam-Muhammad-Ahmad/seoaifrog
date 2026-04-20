import { useCallback, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type AuditDTO, type ReportDTO } from '@seoaifrog/shared'
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle,
  FileSearch,
  FileText,
  FolderKanban,
  Globe,
  Plus,
  SearchCode,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiJson } from '@/lib/api'
import { SetupWizard } from '@/components/wizard/SetupWizard'

interface ProjectDTO {
  id: string
  name: string
  rootUrl?: string | null
}

interface CrawlSessionDTO {
  id: string
  status: string
  createdAt: string
  pageCount?: number | null
}

interface DashboardProjectData {
  project: ProjectDTO
  crawls: CrawlSessionDTO[]
  audits: AuditDTO[]
  reports: ReportDTO[]
}

interface DashboardData {
  projects: DashboardProjectData[]
}

type ActivityRow = {
  id: string
  kind: 'crawl' | 'audit' | 'report'
  label: string
  projectId: string
  projectName: string
  status: string
  createdAt: string
}

type TrendPoint = {
  label: string
  total: number
}

async function fetchProjects(): Promise<ProjectDTO[]> {
  try {
    return await apiJson<ProjectDTO[]>('/api/projects')
  } catch {
    return []
  }
}

async function fetchProjectDashboardData(project: ProjectDTO): Promise<DashboardProjectData> {
  const [crawls, audits, reports] = await Promise.all([
    apiJson<CrawlSessionDTO[]>(`/api/projects/${project.id}/crawls`).catch(() => []),
    apiJson<AuditDTO[]>(`/api/projects/${project.id}/audits`).catch(() => []),
    apiJson<ReportDTO[]>(`/api/projects/${project.id}/reports`).catch(() => []),
  ])
  return { project, crawls, audits, reports }
}

async function fetchDashboardData(): Promise<DashboardData> {
  const projects = await fetchProjects()
  const hydrated = await Promise.all(projects.map((p) => fetchProjectDashboardData(p)))
  return { projects: hydrated }
}

function formatRelative(input: string): string {
  const diff = Date.now() - new Date(input).getTime()
  const hrs = Math.floor(diff / 3_600_000)
  if (hrs < 1) return 'Just now'
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function averageScore(audits: AuditDTO[]): number | null {
  const scored = audits.filter((a) => a.status === 'COMPLETED' && a.overallScore != null)
  if (!scored.length) return null
  return scored.reduce((s, a) => s + (a.overallScore ?? 0), 0) / scored.length
}

function latestScore(project: DashboardProjectData): number | null {
  return project.audits.find((a) => a.status === 'COMPLETED' && a.overallScore != null)?.overallScore ?? null
}

function scoreColor(score: number): string {
  if (score >= 90) return '#16A34A'
  if (score >= 70) return '#65A30D'
  if (score >= 50) return '#D97706'
  if (score >= 30) return '#EA580C'
  return '#DC2626'
}

function scoreLabel(score: number): string {
  if (score >= 90) return 'Excellent'
  if (score >= 70) return 'Good'
  if (score >= 50) return 'Needs work'
  if (score >= 30) return 'Poor'
  return 'Critical'
}

function buildTrendPoints(projects: DashboardProjectData[], days = 7): TrendPoint[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - i - 1))
    const next = new Date(date)
    next.setDate(date.getDate() + 1)
    const inBucket = (d: string) => { const v = new Date(d); return v >= date && v < next }
    const total =
      projects.flatMap((p) => p.crawls).filter((c) => inBucket(c.createdAt)).length +
      projects.flatMap((p) => p.audits).filter((a) => inBucket(a.createdAt)).length +
      projects.flatMap((p) => p.reports).filter((r) => inBucket(r.createdAt)).length
    return { label: date.toLocaleDateString(undefined, { weekday: 'short' }), total }
  })
}

function buildRecentActivity(projects: DashboardProjectData[]): ActivityRow[] {
  const crawls = projects.flatMap((e) =>
    e.crawls.map((c) => ({ id: c.id, kind: 'crawl' as const, label: 'Crawl', projectId: e.project.id, projectName: e.project.name, status: c.status, createdAt: c.createdAt }))
  )
  const audits = projects.flatMap((e) =>
    e.audits.map((a) => ({ id: a.id, kind: 'audit' as const, label: 'Audit', projectId: e.project.id, projectName: e.project.name, status: a.status, createdAt: a.createdAt }))
  )
  const reports = projects.flatMap((e) =>
    e.reports.map((r) => ({ id: r.id, kind: 'report' as const, label: 'Report', projectId: e.project.id, projectName: e.project.name, status: r.format.toUpperCase(), createdAt: r.createdAt }))
  )
  return [...crawls, ...audits, ...reports]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  delta,
  deltaDir = 'flat',
  loading,
  valueColor,
  suffix,
}: {
  label: string
  value: string
  delta?: string
  deltaDir?: 'up' | 'down' | 'flat'
  loading?: boolean
  valueColor?: string
  suffix?: string
}) {
  const deltaColor = deltaDir === 'up' ? 'var(--success)' : deltaDir === 'down' ? 'var(--error)' : 'var(--text-muted)'
  const arrow = deltaDir === 'up' ? '▲' : deltaDir === 'down' ? '▼' : '–'

  return (
    <div className="group rounded-card border border-line bg-surface-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-line-strong hover:shadow-lg hover:shadow-black/[0.07]">
      <p className="font-sans text-[11.5px] font-semibold text-ink-secondary">{label}</p>
      {loading ? (
        <div className="skeleton-pulse mt-2 h-8 w-16 rounded" />
      ) : (
        <p
          className="mt-1 font-mono text-[26px] font-bold leading-none tracking-tight"
          style={{ color: valueColor ?? 'var(--text-primary)', letterSpacing: '-0.01em' }}
        >
          {value}
          {suffix && <span className="ml-0.5 text-[15px] font-medium text-ink-muted">{suffix}</span>}
        </p>
      )}
      {delta && (
        <p className="mt-1.5 font-mono text-[11px]" style={{ color: deltaColor }}>
          {arrow} {delta}
        </p>
      )}
    </div>
  )
}

// ── Score ring (SVG) ──────────────────────────────────────────────────────────
function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const sw = size <= 64 ? 6 : 8
  const r = size / 2 - sw / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color = scoreColor(score)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F5F5F4" strokeWidth={sw} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ}
          className="score-ring-animated"
          style={{ '--score-circumference': circ, '--score-offset': offset } as React.CSSProperties}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono font-bold"
        style={{ color, fontSize: size <= 64 ? 16 : 24 }}
      >
        {score}
        {size > 64 && <span className="ml-0.5 text-[11px] font-medium text-ink-muted">/100</span>}
      </span>
    </div>
  )
}

// ── Trend chart ───────────────────────────────────────────────────────────────
function TrendChart({ points }: { points: TrendPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const W = 460, H = 160
  const max = Math.max(...points.map((p) => p.total), 1)
  const hasData = points.some((p) => p.total > 0)
  const px = 24, pTop = 12, baseY = H - 24

  const coords = points.map((pt, i) => ({
    x: points.length === 1 ? W / 2 : px + (i / (points.length - 1)) * (W - px * 2),
    y: baseY - (pt.total / max) * (baseY - pTop),
    pt,
  }))

  function smooth(pts: { x: number; y: number }[]) {
    if (pts.length < 2) return ''
    let d = `M ${pts[0].x},${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = (pts[i].x + pts[i + 1].x) / 2
      d += ` C ${cx},${pts[i].y} ${cx},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`
    }
    return d
  }

  const curve = smooth(coords)
  const area = curve + ` L ${coords[coords.length - 1].x},${baseY} L ${coords[0].x},${baseY} Z`
  const total = points.reduce((s, p) => s + p.total, 0)
  const active = activeIndex != null ? coords[activeIndex] : null

  const onMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * W
    let best = 0, bestDist = Infinity
    for (let i = 0; i < coords.length; i++) {
      const d = Math.abs(coords[i].x - mx)
      if (d < bestDist) { bestDist = d; best = i }
    }
    setActiveIndex(best)
  }, [coords])

  return (
    <div className="panel">
      <div className="panel-head">
        <TrendingUp className="h-4 w-4 text-brand-primary" aria-hidden />
        <span className="panel-title">Weekly activity</span>
        <span className="panel-sub">Crawls, audits & reports · 7 days</span>
        <div className="panel-tools">
          <span className="flex items-center gap-1 rounded-badge bg-surface-muted px-2.5 py-1 font-mono text-xs text-ink-primary">
            {active ? active.pt.total : total}
            <span className="font-sans text-[11px] text-ink-muted ml-1">{active ? active.pt.label : 'total'}</span>
          </span>
        </div>
      </div>
      <div className="p-5">
        <div className="relative rounded-xl border border-line/50 bg-surface-muted/30 p-3">
          {hasData ? (
            <>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${W} ${H}`}
                className="h-36 w-full cursor-crosshair"
                preserveAspectRatio="none"
                aria-hidden
                onMouseMove={onMove}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <defs>
                  <linearGradient id="cf" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgb(217,119,6)" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="rgb(217,119,6)" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="cs" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#EA580C" />
                  </linearGradient>
                </defs>
                {[0.25, 0.5, 0.75].map((f) => (
                  <line key={f} x1={px} x2={W - px} y1={baseY - f * (baseY - pTop)} y2={baseY - f * (baseY - pTop)} stroke="rgba(168,162,158,0.15)" strokeDasharray="4 4" />
                ))}
                <line x1={px} x2={W - px} y1={baseY} y2={baseY} stroke="rgba(168,162,158,0.25)" />
                <path d={area} fill="url(#cf)" />
                <path d={curve} fill="none" stroke="url(#cs)" strokeWidth="2.5" strokeLinecap="round" />
                {active && (
                  <line x1={active.x} x2={active.x} y1={pTop} y2={baseY} stroke="rgba(217,119,6,0.3)" strokeWidth="1.5" strokeDasharray="3 3" />
                )}
                {coords.map(({ x, y, pt }, i) => {
                  const isActive = activeIndex === i
                  return (
                    <g key={pt.label} opacity={activeIndex == null || isActive ? 1 : 0.35} style={{ transition: 'opacity 0.15s' }}>
                      <circle cx={x} cy={y} r={isActive ? 8 : 6} fill="rgb(217,119,6)" fillOpacity={isActive ? 0.15 : 0.1} />
                      <circle cx={x} cy={y} r={isActive ? 5 : 3.5} fill="white" stroke="rgb(217,119,6)" strokeWidth={isActive ? 2.5 : 2} />
                    </g>
                  )
                })}
                {coords.map((_, i) => {
                  const sw = (W - px * 2) / (points.length - 1)
                  const x = i === 0 ? 0 : coords[i].x - sw / 2
                  const w = i === 0 || i === coords.length - 1 ? sw / 2 + px : sw
                  return <rect key={i} x={x} y={0} width={w} height={H} fill="transparent" onMouseEnter={() => setActiveIndex(i)} />
                })}
              </svg>
              {active && (
                <div className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full" style={{ left: `${(active.x / W) * 100}%` }}>
                  <div className="rounded-lg border border-line bg-surface-card px-3 py-1.5 shadow-lg shadow-black/10">
                    <p className="font-mono text-lg font-bold text-ink-primary">{active.pt.total}</p>
                    <p className="font-sans text-[11px] text-ink-muted">{active.pt.label}</p>
                  </div>
                  <div className="mx-auto h-2 w-2 -translate-y-px rotate-45 border-b border-r border-line bg-surface-card" />
                </div>
              )}
            </>
          ) : (
            <div className="flex h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line text-ink-muted">
              <Sparkles className="h-5 w-5 opacity-40" />
              <p className="font-sans text-sm">No activity yet</p>
            </div>
          )}
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1">
          {points.map((pt, i) => (
            <button
              key={pt.label}
              type="button"
              className={`flex flex-col items-center gap-1 rounded-lg py-1.5 transition-all ${activeIndex === i ? 'bg-brand-primary-light ring-1 ring-brand-primary/20' : 'hover:bg-surface-muted'}`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <span className={`font-mono text-[10px] uppercase tracking-wider ${activeIndex === i ? 'text-brand-deep' : 'text-ink-muted'}`}>{pt.label}</span>
              <span className={`font-mono text-sm font-bold ${activeIndex === i ? 'text-brand-primary' : 'text-ink-primary'}`}>{pt.total}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Activity feed ─────────────────────────────────────────────────────────────
function ActivityFeed({
  items,
  isLoading,
}: {
  items: ActivityRow[]
  isLoading: boolean
}) {
  const kindIcon = (kind: ActivityRow['kind']) => {
    if (kind === 'crawl') return <SearchCode className="h-3.5 w-3.5" />
    if (kind === 'audit') return <FileSearch className="h-3.5 w-3.5" />
    return <FileText className="h-3.5 w-3.5" />
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <Globe className="h-4 w-4 text-brand-primary" aria-hidden />
        <span className="panel-title">Activity</span>
        <span className="panel-sub">Latest work across all projects</span>
      </div>
      <div className="px-5 py-1">
        {isLoading ? (
          <div className="space-y-3 py-3">
            {[0, 1, 2, 3].map((i) => <div key={i} className="skeleton-pulse h-10 w-full rounded" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-ink-muted">
            <Sparkles className="h-5 w-5 opacity-40" />
            <p className="font-sans text-sm">No activity yet</p>
          </div>
        ) : (
          items.map((item) => (
            <div key={`${item.kind}-${item.id}`} className="feed-item">
              <span className="feed-dot">{kindIcon(item.kind)}</span>
              <div>
                <p className="feed-text">
                  <em className="feed-em">{item.projectName}</em> {item.label.toLowerCase()} · {item.status.toLowerCase()}
                </p>
                <time className="feed-time">{formatRelative(item.createdAt)}</time>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Project row ───────────────────────────────────────────────────────────────
function ProjectRow({ entry }: { entry: DashboardProjectData }) {
  const score = latestScore(entry)
  const totalPages = entry.crawls.reduce((s, c) => s + (c.pageCount ?? 0), 0)
  const lastCrawl = entry.crawls[0]?.createdAt
  const badgeText = score == null ? null : score >= 70 ? 'Good' : score >= 50 ? 'Needs work' : 'Critical'
  const badgeClass = score == null ? '' : score >= 70 ? 'badge-ok' : score >= 50 ? 'badge-warn' : 'badge-err'

  return (
    <Link
      to={`/projects/${entry.project.id}`}
      className="focus-ring proj-row group"
    >
      {score != null ? (
        <ScoreRing score={Math.round(score)} size={64} />
      ) : (
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-ink-muted">
          <span className="font-mono text-[10px]">--</span>
        </div>
      )}
      <div className="min-w-0">
        <p className="font-display text-sm font-bold text-ink-primary group-hover:text-brand-primary transition-colors">{entry.project.name}</p>
        <p className="font-mono text-[11.5px] text-ink-muted truncate mt-0.5">{entry.project.rootUrl ?? 'No root URL'}</p>
        <div className="proj-meta">
          {totalPages > 0 && <span>{totalPages.toLocaleString()} pages</span>}
          {totalPages > 0 && <span className="proj-dot" />}
          <span>{entry.audits.length} audits</span>
          {lastCrawl && <><span className="proj-dot" /><span>Crawled {formatRelative(lastCrawl)}</span></>}
        </div>
      </div>
      {badgeText && <span className={`shrink-0 ${badgeClass}`}>{badgeText}</span>}
      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-muted opacity-0 transition-all group-hover:opacity-100 group-hover:text-brand-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: fetchDashboardData,
  })

  const projects = data?.projects ?? []
  const totalProjects = projects.length
  const totalCrawls = projects.reduce((s, p) => s + p.crawls.length, 0)
  const totalAudits = projects.reduce((s, p) => s + p.audits.length, 0)
  const totalReports = projects.reduce((s, p) => s + p.reports.length, 0)
  const allAudits = projects.flatMap((p) => p.audits)
  const avgScore = averageScore(allAudits)
  const trend = buildTrendPoints(projects)
  const recentActivity = buildRecentActivity(projects)
  const topProjects = [...projects]
    .sort((a, b) => (latestScore(b) ?? -1) - (latestScore(a) ?? -1))
    .slice(0, 6)

  const avgScoreNum = avgScore != null ? Math.round(avgScore) : null

  return (
    <div className="space-y-5 pb-10">
      <SetupWizard />

      {/* Page header */}
      <div className="dash-stagger-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink-primary" style={{ letterSpacing: '-0.01em' }}>Dashboard</h1>
          <p className="mt-1 font-sans text-[13px] text-ink-secondary">
            {isLoading ? 'Loading…' : `${totalProjects} project${totalProjects !== 1 ? 's' : ''} · ${totalCrawls} crawls · ${totalReports} reports`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/projects"
            className="btn btn-normal focus-ring"
          >
            <FolderKanban className="h-[15px] w-[15px]" aria-hidden />
            All projects
          </Link>
          <Link
            to="/crawl"
            className="btn btn-primary focus-ring"
          >
            <Plus className="h-[15px] w-[15px]" aria-hidden />
            New crawl
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <section className="dash-stagger-2 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Projects"
          value={isLoading ? '--' : String(totalProjects)}
          delta="Active tracked sites"
          deltaDir="flat"
          loading={isLoading}
        />
        <StatCard
          label="Pages crawled"
          value={isLoading ? '--' : String(totalCrawls)}
          delta={totalCrawls > 0 ? `${totalCrawls} session${totalCrawls !== 1 ? 's' : ''} started` : 'No crawls yet'}
          deltaDir="flat"
          loading={isLoading}
        />
        <StatCard
          label="AI audits"
          value={isLoading ? '--' : String(totalAudits)}
          delta={`${totalReports} reports generated`}
          deltaDir={totalAudits > 0 ? 'up' : 'flat'}
          loading={isLoading}
        />
        <StatCard
          label="Avg SEO score"
          value={isLoading ? '--' : avgScoreNum != null ? String(avgScoreNum) : '--'}
          suffix={avgScoreNum != null ? '/100' : undefined}
          delta={avgScoreNum != null ? scoreLabel(avgScoreNum) : 'Run audits to see score'}
          deltaDir={avgScoreNum != null && avgScoreNum >= 70 ? 'up' : avgScoreNum != null && avgScoreNum < 50 ? 'down' : 'flat'}
          valueColor={avgScoreNum != null ? scoreColor(avgScoreNum) : undefined}
          loading={isLoading}
        />
      </section>

      {/* Chart + Activity */}
      <section className="dash-stagger-3 grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <TrendChart points={trend} />
        <ActivityFeed items={recentActivity} isLoading={isLoading} />
      </section>

      {/* Projects */}
      <section className="dash-stagger-4 panel">
        <div className="panel-head">
          <FolderKanban className="h-4 w-4 text-brand-primary" aria-hidden />
          <span className="panel-title">Projects</span>
          <span className="panel-sub">Best-performing and recently active</span>
          <div className="panel-tools">
            <Link
              to="/projects"
              className="focus-ring btn-ghost inline-flex items-center gap-1 rounded-lg px-3 py-1.5 font-sans text-xs font-semibold text-ink-secondary hover:bg-surface-muted hover:text-ink-primary transition-colors"
            >
              View all
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-px p-2">
            {[0, 1, 2].map((i) => <div key={i} className="skeleton-pulse h-20 w-full rounded-xl" />)}
          </div>
        ) : topProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 text-ink-muted">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
              <FolderKanban className="h-5 w-5 opacity-50" />
            </div>
            <p className="max-w-xs text-center font-sans text-sm">No projects yet. Create one to start seeing dashboard data.</p>
            <Link to="/projects" className="focus-ring btn btn-primary mt-1">
              <Plus className="h-3.5 w-3.5" />
              Create project
            </Link>
          </div>
        ) : (
          <div>
            {topProjects.map((entry) => (
              <ProjectRow key={entry.project.id} entry={entry} />
            ))}
          </div>
        )}
      </section>

      {/* Score summary (only shown when there are scored projects) */}
      {!isLoading && avgScoreNum != null && (
        <section className="dash-stagger-5 panel">
          <div className="panel-head">
            <CheckCircle className="h-4 w-4 text-brand-primary" aria-hidden />
            <span className="panel-title">SEO health</span>
            <span className="panel-sub">Aggregate score across all projects</span>
          </div>
          <div className="flex items-center gap-5 p-5">
            <ScoreRing score={avgScoreNum} size={96} />
            <div className="space-y-2">
              {avgScoreNum < 50 && (
                <div className="alert-row alert-row--crit">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-px" aria-hidden />
                  <div><strong className="font-semibold">Critical score detected.</strong> Run <span className="font-mono text-[11px]">seo-technical</span> and <span className="font-mono text-[11px]">seo-content</span> audits first.</div>
                </div>
              )}
              {avgScoreNum >= 50 && avgScoreNum < 70 && (
                <div className="alert-row alert-row--warn">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-px" aria-hidden />
                  <div><strong className="font-semibold">Score needs improvement.</strong> Prioritize fixing warnings from your latest audit.</div>
                </div>
              )}
              {avgScoreNum >= 70 && (
                <div className="alert-row alert-row--ok">
                  <CheckCircle className="h-4 w-4 shrink-0 mt-px" aria-hidden />
                  <div><strong className="font-semibold">Good overall score.</strong> Continue monitoring and run skill audits to push above 90.</div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
