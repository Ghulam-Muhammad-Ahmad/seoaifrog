import { useCallback, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { type AuditDTO, type ReportDTO } from '@seoaifrog/shared'
import {
  Activity,
  ArrowUpRight,
  FileSearch,
  FileText,
  FolderKanban,
  Globe,
  Plus,
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
  const hydrated = await Promise.all(projects.map((project) => fetchProjectDashboardData(project)))
  return { projects: hydrated }
}

function formatDate(input: string): string {
  return new Date(input).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(input: string): string {
  return new Date(input).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function averageScore(audits: AuditDTO[]): number | null {
  const scores = audits.filter((audit) => audit.status === 'COMPLETED' && audit.overallScore != null)
  if (scores.length === 0) return null
  const total = scores.reduce((sum, audit) => sum + (audit.overallScore ?? 0), 0)
  return total / scores.length
}

function buildTrendPoints(projects: DashboardProjectData[], days = 7): TrendPoint[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days - index - 1))
    const nextDate = new Date(date)
    nextDate.setDate(date.getDate() + 1)

    const isInBucket = (createdAt: string) => {
      const value = new Date(createdAt)
      return value >= date && value < nextDate
    }

    const total =
      projects.flatMap((project) => project.crawls).filter((item) => isInBucket(item.createdAt)).length +
      projects.flatMap((project) => project.audits).filter((item) => isInBucket(item.createdAt)).length +
      projects.flatMap((project) => project.reports).filter((item) => isInBucket(item.createdAt)).length

    return {
      label: date.toLocaleDateString(undefined, { weekday: 'short' }),
      total,
    }
  })
}

function buildRecentActivity(projects: DashboardProjectData[]): ActivityRow[] {
  const crawls = projects.flatMap((entry) =>
    entry.crawls.map((crawl) => ({
      id: crawl.id,
      kind: 'crawl' as const,
      label: 'Crawl',
      projectId: entry.project.id,
      projectName: entry.project.name,
      status: crawl.status,
      createdAt: crawl.createdAt,
    })),
  )

  const audits = projects.flatMap((entry) =>
    entry.audits.map((audit) => ({
      id: audit.id,
      kind: 'audit' as const,
      label: 'Audit',
      projectId: entry.project.id,
      projectName: entry.project.name,
      status: audit.status,
      createdAt: audit.createdAt,
    })),
  )

  const reports = projects.flatMap((entry) =>
    entry.reports.map((report) => ({
      id: report.id,
      kind: 'report' as const,
      label: 'Report',
      projectId: entry.project.id,
      projectName: entry.project.name,
      status: report.format.toUpperCase(),
      createdAt: report.createdAt,
    })),
  )

  return [...crawls, ...audits, ...reports]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)
}

function latestProjectScore(project: DashboardProjectData): number | null {
  const audit = project.audits.find((entry) => entry.status === 'COMPLETED' && entry.overallScore != null)
  return audit?.overallScore ?? null
}

function scoreColor(score: number): string {
  if (score >= 80) return '#16A34A'
  if (score >= 50) return '#CA8A04'
  return '#DC2626'
}

function scoreTrailColor(score: number): string {
  if (score >= 80) return 'rgba(22,163,74,0.12)'
  if (score >= 50) return 'rgba(202,138,4,0.12)'
  return 'rgba(220,38,38,0.12)'
}

const ICON_ACCENT: Record<string, string> = {
  projects: 'from-amber-500 to-orange-600',
  crawls: 'from-cyan-500 to-teal-600',
  audits: 'from-amber-400 to-amber-600',
  score: 'from-emerald-500 to-green-600',
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={`skeleton-pulse ${className ?? ''}`} />
}

function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  accent,
  loading,
}: {
  title: string
  value: string
  helper: string
  icon: typeof FolderKanban
  accent: string
  loading?: boolean
}) {
  return (
    <div className="stat-shimmer group rounded-card border border-line bg-surface-card p-5 transition-all duration-300 hover:border-line-strong hover:shadow-lg hover:shadow-black/[0.04]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[11px] font-bold uppercase tracking-[0.2em] text-ink-muted">{title}</p>
          {loading ? (
            <SkeletonBlock className="mt-3 h-8 w-16" />
          ) : (
            <p className="mt-2 animate-count-up font-display text-3xl font-extrabold tracking-tight text-ink-primary">
              {value}
            </p>
          )}
          <p className="mt-1.5 font-sans text-[13px] leading-relaxed text-ink-secondary">{helper}</p>
        </div>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accent} shadow-sm`}
        >
          <Icon className="h-[18px] w-[18px] text-white" aria-hidden />
        </div>
      </div>
    </div>
  )
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const strokeWidth = 4.5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference
  const color = scoreColor(score)
  const trail = scoreTrailColor(score)

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trail} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          className="score-ring-animated"
          style={
            {
              '--score-circumference': circumference,
              '--score-offset': offset,
            } as React.CSSProperties
          }
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-display text-xs font-bold"
        style={{ color }}
      >
        {score}
      </span>
    </div>
  )
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const width = 460
  const height = 160
  const max = Math.max(...points.map((point) => point.total), 1)
  const hasData = points.some((point) => point.total > 0)
  const paddingX = 24
  const paddingTop = 12
  const baselineY = height - 24

  const coords = points.map((point, index) => {
    const usableWidth = width - paddingX * 2
    const x = points.length === 1 ? width / 2 : paddingX + (index / (points.length - 1)) * usableWidth
    const y = baselineY - (point.total / max) * (baselineY - paddingTop)
    return { x, y, point }
  })

  const totalActivity = points.reduce((s, p) => s + p.total, 0)

  function buildSmoothPath(pts: { x: number; y: number }[]): string {
    if (pts.length < 2) return ''
    let d = `M ${pts[0].x},${pts[0].y}`
    for (let i = 0; i < pts.length - 1; i++) {
      const cx = (pts[i].x + pts[i + 1].x) / 2
      d += ` C ${cx},${pts[i].y} ${cx},${pts[i + 1].y} ${pts[i + 1].x},${pts[i + 1].y}`
    }
    return d
  }

  const curvePath = buildSmoothPath(coords)
  const areaPath = curvePath + ` L ${coords[coords.length - 1].x},${baselineY} L ${coords[0].x},${baselineY} Z`

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current
      if (!svg || coords.length === 0) return
      const rect = svg.getBoundingClientRect()
      const mouseX = ((e.clientX - rect.left) / rect.width) * width
      let closest = 0
      let closestDist = Infinity
      for (let i = 0; i < coords.length; i++) {
        const dist = Math.abs(coords[i].x - mouseX)
        if (dist < closestDist) {
          closestDist = dist
          closest = i
        }
      }
      setActiveIndex(closest)
    },
    [coords, width],
  )

  const handleMouseLeave = useCallback(() => setActiveIndex(null), [])

  const active = activeIndex != null ? coords[activeIndex] : null

  return (
    <div className="rounded-card border border-line bg-surface-card shadow-sm transition-shadow duration-300 hover:shadow-lg hover:shadow-black/[0.03]">
      <div className="flex items-center justify-between gap-3 border-b border-line/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
            <TrendingUp className="h-4 w-4 text-white" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-[15px] font-bold text-ink-primary">Weekly activity</h2>
            <p className="font-sans text-xs text-ink-muted">Crawls, audits & reports over 7 days</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-badge bg-surface-muted px-2.5 py-1">
          <Activity className="h-3.5 w-3.5 text-brand-primary" aria-hidden />
          <span className="font-mono text-xs font-semibold text-ink-primary">
            {active ? active.point.total : totalActivity}
          </span>
          <span className="font-sans text-[11px] text-ink-muted">
            {active ? active.point.label : 'total'}
          </span>
        </div>
      </div>

      <div className="p-6">
        <div className="relative rounded-xl border border-line/50 bg-surface-muted/30 p-4">
          {hasData ? (
            <>
              <svg
                ref={svgRef}
                viewBox={`0 0 ${width} ${height}`}
                className="h-40 w-full cursor-crosshair"
                preserveAspectRatio="none"
                aria-hidden
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
              >
                <defs>
                  <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgb(217,119,6)" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="rgb(217,119,6)" stopOpacity="0.01" />
                  </linearGradient>
                  <linearGradient id="chart-stroke" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#EA580C" />
                  </linearGradient>
                  <linearGradient id="crosshair-grad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="rgb(217,119,6)" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="rgb(217,119,6)" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {[0.25, 0.5, 0.75].map((frac) => (
                  <line
                    key={frac}
                    x1={paddingX}
                    x2={width - paddingX}
                    y1={baselineY - frac * (baselineY - paddingTop)}
                    y2={baselineY - frac * (baselineY - paddingTop)}
                    stroke="rgba(168,162,158,0.15)"
                    strokeDasharray="4 4"
                  />
                ))}
                <line x1={paddingX} x2={width - paddingX} y1={baselineY} y2={baselineY} stroke="rgba(168,162,158,0.25)" />

                <path d={areaPath} fill="url(#chart-fill)" />
                <path d={curvePath} fill="none" stroke="url(#chart-stroke)" strokeWidth="2.5" strokeLinecap="round" />

                {/* Crosshair + active glow */}
                {active && (
                  <g>
                    <line
                      x1={active.x}
                      x2={active.x}
                      y1={paddingTop}
                      y2={baselineY}
                      stroke="url(#crosshair-grad)"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                    <circle cx={active.x} cy={active.y} r="14" fill="rgb(217,119,6)" fillOpacity="0.08">
                      <animate attributeName="r" values="10;14;10" dur="1.5s" repeatCount="indefinite" />
                      <animate attributeName="fill-opacity" values="0.12;0.04;0.12" dur="1.5s" repeatCount="indefinite" />
                    </circle>
                  </g>
                )}

                {coords.map(({ x, y, point }, i) => {
                  const isActive = activeIndex === i
                  return (
                    <g key={point.label} style={{ transition: 'opacity 0.15s' }} opacity={activeIndex == null || isActive ? 1 : 0.35}>
                      <circle cx={x} cy={y} r={isActive ? 8 : 6} fill="rgb(217,119,6)" fillOpacity={isActive ? 0.15 : 0.1} />
                      <circle
                        cx={x}
                        cy={y}
                        r={isActive ? 5 : 3.5}
                        fill="white"
                        stroke="rgb(217,119,6)"
                        strokeWidth={isActive ? 2.5 : 2}
                      />
                    </g>
                  )
                })}

                {/* Invisible hit areas for each point */}
                {coords.map((_, i) => {
                  const sliceWidth = i === 0 || i === coords.length - 1
                    ? (width - paddingX * 2) / (points.length - 1) / 2 + paddingX
                    : (width - paddingX * 2) / (points.length - 1)
                  const sliceX = i === 0
                    ? 0
                    : coords[i].x - sliceWidth / 2
                  return (
                    <rect
                      key={`hit-${i}`}
                      x={sliceX}
                      y={0}
                      width={sliceWidth}
                      height={height}
                      fill="transparent"
                      onMouseEnter={() => setActiveIndex(i)}
                    />
                  )
                })}
              </svg>

              {/* Floating tooltip */}
              {active && (
                <div
                  className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full"
                  style={{
                    left: `${(active.x / width) * 100}%`,
                  }}
                >
                  <div className="rounded-lg border border-line bg-surface-card px-3 py-1.5 shadow-lg shadow-black/10">
                    <p className="font-display text-lg font-extrabold text-ink-primary">{active.point.total}</p>
                    <p className="font-sans text-[11px] text-ink-muted">{active.point.label}</p>
                  </div>
                  <div className="mx-auto h-2 w-2 -translate-y-px rotate-45 border-b border-r border-line bg-surface-card" />
                </div>
              )}
            </>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line text-ink-muted">
              <Sparkles className="h-5 w-5 opacity-40" />
              <p className="font-sans text-sm">No activity yet</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1">
          {points.map((point, i) => (
            <button
              key={point.label}
              type="button"
              className={`flex flex-col items-center gap-1 rounded-lg py-1.5 transition-all duration-150 ${
                activeIndex === i
                  ? 'bg-brand-primary-light ring-1 ring-brand-primary/20'
                  : 'hover:bg-surface-muted'
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
            >
              <span className={`font-mono text-[10px] uppercase tracking-wider transition-colors duration-150 ${
                activeIndex === i ? 'text-brand-deep' : 'text-ink-muted'
              }`}>{point.label}</span>
              <span className={`font-display text-sm font-bold transition-colors duration-150 ${
                activeIndex === i ? 'text-brand-primary' : 'text-ink-primary'
              }`}>{point.total}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ActivityBadge({ kind }: { kind: 'crawl' | 'audit' | 'report' }) {
  const cls = kind === 'crawl' ? 'badge-crawl' : kind === 'audit' ? 'badge-audit' : 'badge-report'
  const label = kind === 'crawl' ? 'Crawl' : kind === 'audit' ? 'Audit' : 'Report'
  return (
    <span className={`inline-flex rounded-badge px-2 py-0.5 font-sans text-[11px] font-semibold ${cls}`}>
      {label}
    </span>
  )
}

function RecentActivityPanel({
  recentActivity,
  isLoading,
}: {
  recentActivity: ActivityRow[]
  isLoading: boolean
}) {
  return (
    <div className="flex flex-col rounded-card border border-line bg-surface-card shadow-sm transition-shadow duration-300 hover:shadow-lg hover:shadow-black/[0.03]">
      <div className="flex items-center justify-between gap-3 border-b border-line/60 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
            <Activity className="h-4 w-4 text-white" aria-hidden />
          </div>
          <div>
            <h2 className="font-display text-[15px] font-bold text-ink-primary">Recent activity</h2>
            <p className="font-sans text-xs text-ink-muted">Latest work across all projects</p>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 py-2">
        {isLoading ? (
          <div className="space-y-3 py-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBlock key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-ink-muted">
            <Sparkles className="h-5 w-5 opacity-40" />
            <p className="font-sans text-sm">No activity yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/60">
            {recentActivity.map((item) => (
              <li
                key={`${item.kind}-${item.id}`}
                className="group flex items-center gap-3 py-3 transition-colors first:pt-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-sans text-sm font-semibold text-ink-primary">
                      {item.projectName}
                    </p>
                    <ActivityBadge kind={item.kind} />
                  </div>
                  <p className="mt-0.5 font-sans text-xs text-ink-muted">{item.status}</p>
                </div>
                <span className="shrink-0 rounded-badge bg-surface-muted px-2 py-0.5 font-mono text-[10px] text-ink-muted">
                  {formatDate(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function ProjectCard({ entry }: { entry: DashboardProjectData }) {
  const score = latestProjectScore(entry)
  return (
    <Link
      to={`/projects/${entry.project.id}`}
      className="focus-ring group flex items-center gap-4 rounded-xl border border-transparent bg-surface-muted/40 p-4 transition-all duration-200 hover:border-line hover:bg-surface-card hover:shadow-md hover:shadow-black/[0.04]"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold text-ink-primary group-hover:text-brand-primary transition-colors duration-200">
          {entry.project.name}
        </p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-ink-muted">
          {entry.project.rootUrl ?? 'No root URL'}
        </p>
        <div className="mt-2 flex items-center gap-4">
          <span className="font-sans text-[11px] text-ink-muted">
            <span className="font-semibold text-ink-secondary">{entry.crawls.length}</span> crawls
          </span>
          <span className="font-sans text-[11px] text-ink-muted">
            <span className="font-semibold text-ink-secondary">{entry.audits.length}</span> audits
          </span>
          {entry.audits[0] && (
            <span className="font-sans text-[11px] text-ink-muted">
              {formatDateTime(entry.audits[0].createdAt)}
            </span>
          )}
        </div>
      </div>

      {score != null ? (
        <ScoreRing score={score} size={48} />
      ) : (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-ink-muted">
          <span className="font-mono text-[10px]">--</span>
        </div>
      )}

      <ArrowUpRight className="h-4 w-4 shrink-0 text-ink-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-brand-primary group-hover:opacity-100" />
    </Link>
  )
}

export function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: fetchDashboardData,
  })

  const projects = data?.projects ?? []
  const totalProjects = projects.length
  const totalCrawls = projects.reduce((sum, project) => sum + project.crawls.length, 0)
  const totalAudits = projects.reduce((sum, project) => sum + project.audits.length, 0)
  const totalReports = projects.reduce((sum, project) => sum + project.reports.length, 0)
  const allAudits = projects.flatMap((project) => project.audits)
  const avgScore = averageScore(allAudits)
  const trend = buildTrendPoints(projects)
  const recentActivity = buildRecentActivity(projects)
  const topProjects = [...projects]
    .sort((a, b) => (latestProjectScore(b) ?? -1) - (latestProjectScore(a) ?? -1))
    .slice(0, 5)

  return (
    <div className="space-y-8 pb-8">
      <SetupWizard />
      {/* Header */}
      <div className="dash-stagger-1 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink-primary">Dashboard</h1>
          </div>
          <p className="mt-2 max-w-lg font-sans text-sm leading-relaxed text-ink-secondary">
            Your command center for projects, audits, crawls, and performance insights.
          </p>
        </div>
        <Link
          to="/projects"
          className="focus-ring group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 font-sans text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/30 hover:brightness-110"
        >
          <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" aria-hidden />
          Projects
        </Link>
      </div>

      {/* Stat cards */}
      <section className="dash-stagger-2 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Projects"
          value={isLoading ? '--' : String(totalProjects)}
          helper="Active tracked sites"
          icon={FolderKanban}
          accent={ICON_ACCENT.projects}
          loading={isLoading}
        />
        <StatCard
          title="Crawls"
          value={isLoading ? '--' : String(totalCrawls)}
          helper="Sessions started"
          icon={Globe}
          accent={ICON_ACCENT.crawls}
          loading={isLoading}
        />
        <StatCard
          title="Audits"
          value={isLoading ? '--' : String(totalAudits)}
          helper="SEO audits created"
          icon={FileSearch}
          accent={ICON_ACCENT.audits}
          loading={isLoading}
        />
        <StatCard
          title="Avg score"
          value={isLoading ? '--' : avgScore == null ? '--' : String(Math.round(avgScore))}
          helper={isLoading ? 'Loading...' : `${totalReports} reports generated`}
          icon={FileText}
          accent={ICON_ACCENT.score}
          loading={isLoading}
        />
      </section>

      {/* Chart + Activity */}
      <section className="dash-stagger-3 grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <TrendChart points={trend} />
        <RecentActivityPanel recentActivity={recentActivity} isLoading={isLoading} />
      </section>

      {/* Projects table */}
      <section className="dash-stagger-4 rounded-card border border-line bg-surface-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 shadow-sm">
              <FolderKanban className="h-4 w-4 text-white" aria-hidden />
            </div>
            <div>
              <h2 className="font-display text-[15px] font-bold text-ink-primary">Top projects</h2>
              <p className="font-sans text-xs text-ink-muted">Best-performing and recently active</p>
            </div>
          </div>
          <Link
            to="/projects"
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-3 py-1.5 font-sans text-xs font-bold text-ink-secondary transition-colors hover:bg-surface-subtle hover:text-ink-primary"
          >
            View all
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <SkeletonBlock key={i} className="h-[72px] w-full" />
              ))}
            </div>
          ) : topProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-ink-muted">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
                <FolderKanban className="h-5 w-5 opacity-50" />
              </div>
              <p className="max-w-xs text-center font-sans text-sm">
                No projects yet. Create one to start seeing dashboard data.
              </p>
              <Link
                to="/projects"
                className="focus-ring mt-1 inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-bold text-white hover:bg-brand-primary-hover"
              >
                <Plus className="h-3.5 w-3.5" />
                Create project
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {topProjects.map((entry) => (
                <ProjectCard key={entry.project.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
