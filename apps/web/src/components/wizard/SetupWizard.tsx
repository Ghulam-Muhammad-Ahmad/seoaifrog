import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronUp,
  FileSearch,
  FolderKanban,
  Gauge,
  Globe,
  Minus,
  Sparkles,
  X,
} from 'lucide-react'
import { type FormEvent, useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError, apiJson } from '@/lib/api'

const DISMISSED_KEY = 'setup_wizard_dismissed'
const MINIMIZED_KEY = 'setup_wizard_minimized'

interface ProjectDTO {
  id: string
  name: string
  rootUrl?: string | null
  domain?: string
}

interface CrawlDTO {
  id: string
  status: string
}

interface SpeedTestDTO {
  id: string
}

interface AuditDTO {
  id: string
  status: string
}

function normalizeUrl(input: string): { rootUrl: string; domain: string } | null {
  let s = input.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    if (!u.hostname) return null
    const rootUrl =
      u.pathname === '/' || u.pathname === ''
        ? u.origin
        : `${u.origin}${u.pathname}`.replace(/\/$/, '')
    return { rootUrl, domain: u.hostname }
  } catch {
    return null
  }
}

// ─── Step panels ────────────────────────────────────────────────────────────

function StepCreateProject({
  name,
  setName,
  urlInput,
  setUrlInput,
  formError,
  isPending,
  onSubmit,
}: {
  name: string
  setName: (v: string) => void
  urlInput: string
  setUrlInput: (v: string) => void
  formError: string | null
  isPending: boolean
  onSubmit: (e: FormEvent) => void
}) {
  return (
    <div>
      <p className="font-sans text-sm text-ink-secondary">
        Start by naming your workspace and providing the root URL of the site you want to audit.
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="wiz-name" className="block font-sans text-xs font-semibold text-ink-secondary">
            Project name
          </label>
          <input
            id="wiz-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="focus-ring mt-1 w-full rounded-lg border border-line-strong bg-surface-card px-3 py-2 font-sans text-sm text-ink-primary placeholder:text-ink-muted"
            placeholder="My site Q1"
            autoComplete="off"
            autoFocus
          />
        </div>
        <div>
          <label htmlFor="wiz-url" className="block font-sans text-xs font-semibold text-ink-secondary">
            Site URL
          </label>
          <input
            id="wiz-url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            className="focus-ring mt-1 w-full rounded-lg border border-line-strong bg-surface-card px-3 py-2 font-mono text-sm text-ink-primary placeholder:text-ink-muted"
            placeholder="https://example.com"
            autoComplete="url"
          />
          <p className="mt-1 font-sans text-[11px] text-ink-muted">https:// is added automatically if omitted.</p>
        </div>
        {formError ? <p className="font-sans text-xs text-semantic-error">{formError}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="focus-ring w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-2.5 font-sans text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all hover:brightness-110 disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create project'}
        </button>
      </form>
    </div>
  )
}

function StepNavigate({
  description,
  ctaLabel,
  onCta,
  hint,
}: {
  description: string
  ctaLabel: string
  onCta: () => void
  hint?: string
}) {
  return (
    <div>
      <p className="font-sans text-sm text-ink-secondary">{description}</p>
      {hint ? <p className="mt-2 font-sans text-xs text-ink-muted">{hint}</p> : null}
      <button
        type="button"
        onClick={onCta}
        className="focus-ring mt-5 w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-2.5 font-sans text-sm font-bold text-white shadow-md shadow-amber-500/20 transition-all hover:brightness-110"
      >
        {ctaLabel}
      </button>
    </div>
  )
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

type StepMeta = {
  step: number
  label: string
  Icon: typeof FolderKanban
}

const STEPS: StepMeta[] = [
  { step: 1, label: 'Create project', Icon: FolderKanban },
  { step: 2, label: 'Crawl site', Icon: Globe },
  { step: 3, label: 'Speed test', Icon: Gauge },
  { step: 4, label: 'AI audit', Icon: FileSearch },
]

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center px-6 py-4 border-b border-line/60">
      {STEPS.map(({ step, label, Icon }, i) => {
        const done = step < current
        const active = step === current
        return (
          <div key={step} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : active
                      ? 'border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-400/30'
                      : 'border-line bg-surface-muted text-ink-muted'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>
              <span
                className={`font-sans text-[10px] font-semibold text-center leading-tight truncate max-w-full px-1 ${
                  active ? 'text-amber-600' : done ? 'text-emerald-600' : 'text-ink-muted'
                }`}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-0.5 w-4 shrink-0 mx-0.5 mb-4 rounded transition-all ${
                  done ? 'bg-emerald-400' : 'bg-line'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Minimized pill ───────────────────────────────────────────────────────────

function MinimizedPill({
  currentStep,
  onExpand,
  onDismiss,
}: {
  currentStep: number
  onExpand: () => void
  onDismiss: () => void
}) {
  const completedCount = currentStep - 1
  const stepLabel = STEPS[currentStep - 1]?.label ?? 'Complete'

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl border border-line bg-surface-card px-4 py-3 shadow-xl shadow-black/10 ring-1 ring-black/5">
      {/* Icon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
        <Sparkles className="h-4 w-4 text-white" />
      </div>

      {/* Text */}
      <button
        type="button"
        onClick={onExpand}
        className="flex min-w-0 flex-col text-left focus:outline-none"
      >
        <span className="font-sans text-xs font-bold text-ink-primary leading-tight">
          Setup guide
        </span>
        <span className="font-sans text-[11px] text-ink-muted leading-tight">
          {completedCount}/4 done · {stepLabel}
        </span>
      </button>

      {/* Progress dots */}
      <div className="flex items-center gap-1 mx-1">
        {STEPS.map(({ step }) => (
          <div
            key={step}
            className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
              step < currentStep
                ? 'bg-emerald-500'
                : step === currentStep
                  ? 'bg-amber-500'
                  : 'bg-line'
            }`}
          />
        ))}
      </div>

      {/* Expand */}
      <button
        type="button"
        onClick={onExpand}
        aria-label="Expand setup wizard"
        className="focus-ring rounded-lg p-1 text-ink-muted hover:bg-surface-muted hover:text-ink-primary"
      >
        <ChevronUp className="h-4 w-4" />
      </button>

      {/* Dismiss */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss setup wizard"
        className="focus-ring rounded-lg p-1 text-ink-muted hover:bg-surface-muted hover:text-ink-primary"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Main wizard ─────────────────────────────────────────────────────────────

export function SetupWizard() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISSED_KEY) === 'true',
  )
  const [minimized, setMinimized] = useState(
    () => localStorage.getItem(MINIMIZED_KEY) === 'true',
  )
  const [name, setName] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const minimize = useCallback(() => {
    localStorage.setItem(MINIMIZED_KEY, 'true')
    setMinimized(true)
  }, [])

  const expand = useCallback(() => {
    localStorage.removeItem(MINIMIZED_KEY)
    setMinimized(false)
  }, [])

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, 'true')
    localStorage.removeItem(MINIMIZED_KEY)
    setDismissed(true)
  }, [])

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ['wiz-projects'],
    queryFn: () => apiJson<ProjectDTO[]>('/api/projects').catch(() => [] as ProjectDTO[]),
    enabled: !dismissed,
    staleTime: 0,
  })

  const firstProject = projects[0]

  const { data: crawls = [], isLoading: loadingCrawls } = useQuery({
    queryKey: ['wiz-crawls', firstProject?.id],
    queryFn: () =>
      apiJson<CrawlDTO[]>(`/api/projects/${firstProject!.id}/crawls`).catch(() => [] as CrawlDTO[]),
    enabled: !dismissed && Boolean(firstProject),
    staleTime: 0,
  })

  const hasCrawls = crawls.length > 0

  const { data: speedTests = [], isLoading: loadingSpeed } = useQuery({
    queryKey: ['wiz-speed', firstProject?.id],
    queryFn: async () => {
      const res = await apiJson<{ items: SpeedTestDTO[] }>(
        `/api/projects/${firstProject!.id}/speed-tests`,
      ).catch(() => ({ items: [] as SpeedTestDTO[] }))
      return Array.isArray(res.items) ? res.items : []
    },
    enabled: !dismissed && Boolean(firstProject) && hasCrawls,
    staleTime: 0,
  })

  const hasSpeedTests = speedTests.length > 0

  const { data: audits = [], isLoading: loadingAudits } = useQuery({
    queryKey: ['wiz-audits', firstProject?.id],
    queryFn: () =>
      apiJson<AuditDTO[]>(`/api/projects/${firstProject!.id}/audits`).catch(() => [] as AuditDTO[]),
    enabled: !dismissed && Boolean(firstProject) && hasCrawls && hasSpeedTests,
    staleTime: 0,
  })

  const hasAudits = audits.length > 0

  const createMutation = useMutation({
    mutationFn: (body: { name: string; domain: string; rootUrl: string }) =>
      apiJson<ProjectDTO>('/api/projects', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wiz-projects'] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] })
      setName('')
      setUrlInput('')
      setFormError(null)
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : 'Could not create project')
    },
  })

  // ── Determine current step ────────────────────────────────────────────────
  const isLoading = loadingProjects || loadingCrawls || loadingSpeed || loadingAudits

  let currentStep = 1
  if (projects.length > 0) currentStep = 2
  if (projects.length > 0 && hasCrawls) currentStep = 3
  if (projects.length > 0 && hasCrawls && hasSpeedTests) currentStep = 4
  const allDone = projects.length > 0 && hasCrawls && hasSpeedTests && hasAudits

  if (dismissed || (!isLoading && allDone)) return null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = normalizeUrl(urlInput)
    if (!name.trim()) { setFormError('Enter a project name'); return }
    if (!parsed) { setFormError('Enter a valid URL (e.g. https://example.com)'); return }
    createMutation.mutate({ name: name.trim(), domain: parsed.domain, rootUrl: parsed.rootUrl })
  }

  const stepTitles: Record<number, string> = {
    1: 'Create your first project',
    2: 'Crawl your site',
    3: 'Run a speed test',
    4: 'Run an AI audit',
  }

  // ── Minimized pill ────────────────────────────────────────────────────────
  if (minimized) {
    return (
      <MinimizedPill
        currentStep={currentStep}
        onExpand={expand}
        onDismiss={dismiss}
      />
    )
  }

  // ── Full modal ────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-primary/50 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-line bg-surface-card shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/60 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-sm">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-ink-primary">Getting started</h2>
              <p className="font-sans text-xs text-ink-muted">
                Step {Math.min(currentStep, 4)} of 4 — {stepTitles[Math.min(currentStep, 4)]}
              </p>
            </div>
          </div>
          {/* Minimize button */}
          <button
            type="button"
            onClick={minimize}
            aria-label="Minimize setup wizard"
            className="focus-ring rounded-lg p-1.5 text-ink-muted hover:bg-surface-muted hover:text-ink-primary"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>

        {/* Stepper */}
        <Stepper current={currentStep} />

        {/* Body */}
        <div className="px-6 py-6">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {currentStep === 1 && (
                <StepCreateProject
                  name={name}
                  setName={setName}
                  urlInput={urlInput}
                  setUrlInput={setUrlInput}
                  formError={formError}
                  isPending={createMutation.isPending}
                  onSubmit={handleSubmit}
                />
              )}

              {currentStep === 2 && firstProject && (
                <StepNavigate
                  description={`Great — project "${firstProject.name}" is ready. Now crawl your site so SEO AI Frog can discover all your pages.`}
                  ctaLabel="Start crawl"
                  hint="You'll configure crawl depth and settings on the next page. Come back here once the crawl is running."
                  onCta={() => navigate(`/projects/${firstProject.id}/crawl/config`)}
                />
              )}

              {currentStep === 3 && firstProject && (
                <StepNavigate
                  description="Crawl is underway. Next, run a PageSpeed test to measure your site's Core Web Vitals and performance."
                  ctaLabel="Run speed test"
                  hint="A Google PageSpeed API key is optional but gives more accurate data. You can configure it in Settings."
                  onCta={() => navigate(`/projects/${firstProject.id}/speed`)}
                />
              )}

              {currentStep === 4 && firstProject && (
                <StepNavigate
                  description="Almost there! Now let Claude AI analyse your crawl and speed data to produce a full SEO audit report."
                  ctaLabel="Start AI audit"
                  onCta={() => navigate(`/projects/${firstProject.id}/audit`)}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-line/60 px-6 py-3 text-right">
          <button
            type="button"
            onClick={dismiss}
            className="font-sans text-xs text-ink-muted hover:text-ink-secondary"
          >
            Skip setup
          </button>
        </div>
      </div>
    </div>
  )
}
