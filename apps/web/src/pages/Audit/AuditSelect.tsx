import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, XCircle } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SKILL_IDS, SKILL_PRESETS, type AuditDTO, type SkillId } from '@seoaifrog/shared'
import { apiJson } from '@/lib/api'
import { useProject } from '@/contexts/ProjectContext'

type CrawlListItem = {
  id: string
  status: string
  createdAt: string
  completedAt: string | null
}

async function fetchCrawls(projectId: string): Promise<CrawlListItem[]> {
  try {
    return await apiJson<CrawlListItem[]>(`/api/projects/${projectId}/crawls`)
  } catch {
    return []
  }
}

async function fetchAudits(projectId: string): Promise<AuditDTO[]> {
  try {
    return await apiJson<AuditDTO[]>(`/api/projects/${projectId}/audits`)
  } catch {
    return []
  }
}

const PRESET_LABELS: Record<keyof typeof SKILL_PRESETS, string> = {
  full: 'Full audit',
  technical: 'Technical',
  content: 'Content',
  quick: 'Quick',
}
const COMPREHENSIVE_AUDIT_SKILL: SkillId = 'seo-audit'
const OTHER_SKILL_IDS: SkillId[] = SKILL_IDS.filter(
  (id): id is SkillId => id !== COMPREHENSIVE_AUDIT_SKILL,
)

function normalizeSelectedSkills(skills: Iterable<SkillId>): Set<SkillId> {
  const next = new Set(skills)
  if (next.has(COMPREHENSIVE_AUDIT_SKILL)) return new Set([COMPREHENSIVE_AUDIT_SKILL])
  return next
}

export function AuditSelect() {
  const { projectId: paramProjectId } = useParams<{ projectId?: string }>()
  const { selectedProjectId, selectedProject: ctxProject } = useProject()
  const projectId = paramProjectId ?? selectedProjectId
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Set<SkillId>>(() => new Set(SKILL_PRESETS.quick))
  const [crawlSessionId, setCrawlSessionId] = useState<string>('')
  const [runMode, setRunMode] = useState<'crawl' | 'url'>('crawl')
  const [targetUrl, setTargetUrl] = useState('')
  const crawlDefaulted = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: crawls = [] } = useQuery({
    queryKey: ['project-crawls', projectId],
    queryFn: () => fetchCrawls(projectId!),
    enabled: Boolean(projectId),
  })
  const {
    data: audits = [],
    isFetching: auditsFetching,
    refetch: refetchAudits,
  } = useQuery({
    queryKey: ['project-audits', projectId],
    queryFn: () => fetchAudits(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: (q) => {
      const hasActive = (q.state.data ?? []).some((a) => a.status === 'PENDING' || a.status === 'RUNNING')
      return hasActive ? 3000 : false
    },
  })

  const cancelAuditMutation = useMutation({
    mutationFn: async (auditId: string) =>
      await apiJson<AuditDTO>(`/api/audits/${auditId}/cancel`, { method: 'POST', body: '{}' }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['project-audits', projectId] }),
        queryClient.invalidateQueries({ queryKey: ['audit'] }),
      ])
    },
  })

  useEffect(() => {
    crawlDefaulted.current = false
    setCrawlSessionId('')
    setTargetUrl('')
    setRunMode('crawl')
  }, [projectId])

  useEffect(() => {
    if (crawlDefaulted.current || crawls.length === 0) return
    crawlDefaulted.current = true
    const best = crawls.find((c) => c.status === 'COMPLETED') ?? crawls[0]
    setCrawlSessionId(best.id)
  }, [crawls])

  function applyPreset(key: keyof typeof SKILL_PRESETS) {
    setSelected(normalizeSelectedSkills(SKILL_PRESETS[key] as readonly SkillId[]))
  }

  function toggle(id: SkillId) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (id === COMPREHENSIVE_AUDIT_SKILL) {
        if (next.has(id)) return new Set()
        return new Set([COMPREHENSIVE_AUDIT_SKILL])
      }
      if (next.has(id)) next.delete(id)
      else next.add(id)
      next.delete(COMPREHENSIVE_AUDIT_SKILL)
      return normalizeSelectedSkills(next)
    })
  }

  async function startAudit() {
    if (!projectId) return

    let normalizedTargetUrl: string | null = null
    if (runMode === 'url') {
      const raw = targetUrl.trim()
      if (!raw) {
        setError('Enter a URL to run a specific-URL audit.')
        return
      }
      try {
        const target = new URL(raw)
        const root = new URL(ctxProject?.rootUrl ?? '')
        const normalizeHost = (host: string) => host.toLowerCase().replace(/^www\./, '')
        if (normalizeHost(target.hostname) !== normalizeHost(root.hostname)) {
          setError('URL must be within the selected project domain.')
          return
        }
        normalizedTargetUrl = target.href
      } catch {
        setError('Enter a valid full URL (e.g. https://example.com/page).')
        return
      }
    }

    setPending(true)
    setError(null)
    try {
      const normalizedSkills = [...normalizeSelectedSkills(selected)]
      const audit = await apiJson<{ id: string }>(`/api/projects/${projectId}/audits`, {
        method: 'POST',
        body: JSON.stringify({
          skills: normalizedSkills,
          crawlSessionId: runMode === 'crawl' ? crawlSessionId.trim() || null : null,
          targetUrl: runMode === 'url' ? normalizedTargetUrl : null,
        }),
      })
      navigate(`/projects/${projectId}/audit/${audit.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start audit')
    } finally {
      setPending(false)
    }
  }

  const projectReady = Boolean(projectId)
  const pendingCount = audits.filter((a) => a.status === 'PENDING').length
  const runningCount = audits.filter((a) => a.status === 'RUNNING').length
  const completedCount = audits.filter((a) => a.status === 'COMPLETED').length
  const failedCount = audits.filter((a) => a.status === 'FAILED').length

  const statusPill = (status: AuditDTO['status']) => {
    if (status === 'COMPLETED') return 'bg-semantic-success-light text-semantic-success'
    if (status === 'FAILED') return 'bg-semantic-error-light text-semantic-error'
    if (status === 'RUNNING') return 'bg-brand-primary/15 text-brand-deep'
    return 'bg-surface-muted text-ink-secondary'
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-primary">SEO audits</h1>
          <p className="mt-1 font-sans text-sm text-ink-secondary">Start a new audit and manage existing audits.</p>
        </div>
      </div>

      {!projectReady ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-surface-muted/30 p-8 text-center">
          <p className="font-sans text-sm text-ink-secondary">Select a project from the header to get started.</p>
        </div>
      ) : null}

      <div className={`mt-6 rounded-card border border-line bg-surface-card p-4 ${!projectReady ? 'pointer-events-none opacity-50' : ''}`}>
        <h2 className="font-display text-lg font-semibold text-ink-primary">Start new audit</h2>
        <p className="mt-0.5 font-sans text-xs text-ink-secondary">
          Configure source + skills, then launch a new audit run.
        </p>

      <div className={`mt-6 grid gap-4 lg:grid-cols-2 ${!projectReady ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="rounded-card border border-line bg-surface-card p-4">
          <p className="font-sans text-sm font-semibold text-ink-primary">Audit source</p>
          <p className="mt-1 font-sans text-xs text-ink-secondary">
            Run against one crawl, or scope audit prompts to a single URL in this project.
          </p>

          <div className="mt-3 space-y-2">
            <label className="focus-ring flex cursor-pointer items-start gap-2 rounded-lg border border-line px-3 py-2 hover:bg-surface-muted/40">
              <input
                type="radio"
                name="audit-mode"
                checked={runMode === 'crawl'}
                onChange={() => setRunMode('crawl')}
              />
              <span>
                <span className="block font-sans text-sm font-semibold text-ink-primary">Crawl session</span>
                <span className="block font-sans text-xs text-ink-secondary">Use all sampled crawl rows.</span>
              </span>
            </label>

            <label className="focus-ring flex cursor-pointer items-start gap-2 rounded-lg border border-line px-3 py-2 hover:bg-surface-muted/40">
              <input
                type="radio"
                name="audit-mode"
                checked={runMode === 'url'}
                onChange={() => setRunMode('url')}
              />
              <span>
                <span className="block font-sans text-sm font-semibold text-ink-primary">Specific URL</span>
                <span className="block font-sans text-xs text-ink-secondary">
                  URL must match project domain: {ctxProject?.rootUrl ?? 'select project first'}.
                </span>
              </span>
            </label>
          </div>

          {runMode === 'url' ? (
            <div className="mt-3">
              <label className="block font-sans text-xs font-semibold text-ink-secondary" htmlFor="audit-target-url">
                Target URL
              </label>
              <input
                id="audit-target-url"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
                placeholder="https://example.com/page"
                className="focus-ring mt-1 w-full rounded-lg border border-line bg-surface-muted/40 px-3 py-2 font-mono text-xs text-ink-primary"
              />
            </div>
          ) : null}
        </div>

        <div
          className={`rounded-card border border-line bg-surface-card p-4 ${
            runMode !== 'crawl' ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <label className="block font-sans text-sm font-semibold text-ink-primary" htmlFor="audit-crawl">
            Crawl session
          </label>
          <p className="mt-1 font-sans text-xs text-ink-secondary">
            Include crawl config, stats, and crawled pages in the audit payload.
          </p>
          <select
            id="audit-crawl"
            value={crawlSessionId}
            onChange={(e) => setCrawlSessionId(e.target.value)}
            className="focus-ring mt-3 w-full rounded-lg border border-line bg-surface-muted/40 px-3 py-2 font-mono text-xs text-ink-primary"
          >
            <option value="">None (project only, no crawl rows)</option>
            {crawls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.status} · {new Date(c.createdAt).toLocaleString()} · {c.id.slice(0, 8)}…
              </option>
            ))}
          </select>
          {crawls.length === 0 ? (
            <p className="mt-2 font-sans text-xs text-ink-muted">No crawls yet — run a crawl from the project first.</p>
          ) : null}
        </div>
      </div>

      <div className={`mt-6 flex flex-wrap gap-2 ${!projectReady ? 'pointer-events-none opacity-50' : ''}`}>
        {(['full', 'technical', 'content', 'quick'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => applyPreset(key)}
            className="focus-ring rounded-lg border border-line-strong bg-surface-card px-3 py-1.5 font-sans text-xs font-semibold text-ink-primary hover:border-brand-primary/50"
          >
            {PRESET_LABELS[key]}
          </button>
        ))}
      </div>

      <div className={`mt-6 ${!projectReady ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="rounded-card border border-brand-primary/30 bg-brand-primary/5 p-4">
          <p className="font-sans text-sm font-semibold text-ink-primary">Comprehensive SEO audit</p>
          <p className="mt-1 font-sans text-xs text-ink-secondary">
            `seo-audit` is a master comprehensive analysis and runs as a standalone skill.
          </p>
          <label className="focus-ring mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-card px-3 py-2 font-mono text-xs hover:bg-surface-muted/60">
            <input
              type="checkbox"
              checked={selected.has(COMPREHENSIVE_AUDIT_SKILL)}
              onChange={() => toggle(COMPREHENSIVE_AUDIT_SKILL)}
            />
            {COMPREHENSIVE_AUDIT_SKILL}
          </label>
        </div>

        <p className="mt-4 font-sans text-xs font-semibold uppercase tracking-wide text-ink-secondary">Other skills</p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {OTHER_SKILL_IDS.map((id) => (
            <li key={id}>
              <label className="focus-ring flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface-card px-3 py-2 font-mono text-xs hover:bg-surface-muted/60">
                <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} />
                {id}
              </label>
            </li>
          ))}
        </ul>
      </div>
      {selected.has(COMPREHENSIVE_AUDIT_SKILL) ? (
        <p className="mt-2 font-sans text-xs text-ink-secondary">
          `seo-audit` is comprehensive, so it runs alone and disables other skills automatically.
        </p>
      ) : null}

      {error ? <p className="mt-4 font-sans text-xs text-semantic-error">{error}</p> : null}

      <button
        type="button"
        disabled={pending || selected.size === 0 || !projectReady}
        onClick={() => void startAudit()}
        className="focus-ring mt-8 rounded-lg bg-brand-primary px-5 py-2.5 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-50"
      >
        {pending ? 'Starting…' : 'Start audit'}
      </button>
      </div>

      <div className={`mt-10 rounded-card border border-line bg-surface-card p-4 ${!projectReady ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-primary">Existing audits</h2>
            <p className="mt-0.5 font-sans text-xs text-ink-secondary">
              Pending {pendingCount} · Running {runningCount} · Completed {completedCount} · Failed {failedCount}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refetchAudits()}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-card px-3 py-1.5 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${auditsFetching ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>

        {audits.length === 0 ? (
          <p className="mt-3 font-sans text-xs text-ink-muted">No audits for this project yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {audits.slice(0, 20).map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-muted/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-ink-primary">
                    {new Date(a.createdAt).toLocaleString()} · {a.id.slice(0, 8)}…
                  </p>
                  <p className="mt-0.5 font-sans text-xs text-ink-secondary">
                    {a.targetUrl ? `URL: ${a.targetUrl}` : a.crawlSessionId ? `Crawl: ${a.crawlSessionId.slice(0, 8)}…` : 'Project-only'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 font-sans text-xs font-semibold ${statusPill(a.status)}`}>
                    {a.status}
                  </span>
                  <Link
                    to={`/projects/${a.projectId}/audit/${a.id}`}
                    className="focus-ring rounded-md border border-line-strong bg-surface-card px-2 py-1 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted"
                  >
                    Open
                  </Link>
                  {(a.status === 'PENDING' || a.status === 'RUNNING') ? (
                    <button
                      type="button"
                      onClick={() => cancelAuditMutation.mutate(a.id)}
                      disabled={cancelAuditMutation.isPending}
                      className="focus-ring inline-flex items-center gap-1 rounded-md border border-line-strong bg-surface-card px-2 py-1 font-sans text-xs font-semibold text-semantic-error hover:bg-surface-muted disabled:opacity-60"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden />
                      Cancel
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
