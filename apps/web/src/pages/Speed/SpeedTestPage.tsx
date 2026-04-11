import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { SpeedTestDTO, SpeedTestListDTO } from '@seoaifrog/shared'
import { apiJson, ApiError } from '@/lib/api'

type ProjectRow = { id: string; name: string; rootUrl: string }
type AccountSettingsResponse = {
  user?: {
    googlePsiConfigured?: boolean
    googlePsiTokenExpiresAt?: string | null
    pageSpeedKeyConfigured?: boolean
  } | null
}

async function fetchProjects(): Promise<ProjectRow[]> {
  try {
    return await apiJson<ProjectRow[]>('/api/projects')
  } catch {
    return []
  }
}

async function fetchSpeedTests(projectId: string): Promise<SpeedTestDTO[]> {
  const res = await apiJson<SpeedTestListDTO>(`/api/projects/${projectId}/speed-tests`)
  return Array.isArray(res.items) ? res.items : []
}

async function fetchAccountSettings(): Promise<AccountSettingsResponse> {
  return await apiJson<AccountSettingsResponse>('/api/account/settings')
}

export function SpeedTestPage() {
  const { projectId } = useParams<{ projectId?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [showOauthHelp, setShowOauthHelp] = useState(false)

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const { data: settings } = useQuery({
    queryKey: ['account', 'settings'],
    queryFn: fetchAccountSettings,
  })

  const {
    data: tests = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ['project-speed-tests', projectId],
    queryFn: () => fetchSpeedTests(projectId!),
    enabled: Boolean(projectId),
  })

  const runMutation = useMutation({
    mutationFn: async (payload: { url: string; strategy: 'mobile' | 'desktop' }) =>
      await apiJson<SpeedTestDTO>(`/api/projects/${projectId}/speed-tests`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-speed-tests', projectId] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      await apiJson(`/api/speed-tests/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['project-speed-tests', projectId] })
    },
  })

  const currentProject = projects.find((p) => p.id === projectId)
  const defaultUrl = currentProject?.rootUrl ?? ''
  const oauthConfigured = settings?.user?.googlePsiConfigured === true
  const pageSpeedKeyConfigured = settings?.user?.pageSpeedKeyConfigured === true
  const speedCredentialsConfigured = oauthConfigured || pageSpeedKeyConfigured
  const tokenExpiry = settings?.user?.googlePsiTokenExpiresAt ?? null

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-primary">Speed testing</h1>
      <p className="mt-1 font-sans text-sm text-ink-secondary">
        Run user-triggered Google PageSpeed tests and keep results for audits/reports.
      </p>

      <div className="mt-6 rounded-card border border-line bg-surface-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <label className="block font-sans text-sm font-semibold text-ink-primary" htmlFor="speed-project">
              Project
            </label>
            <p className="mt-1 font-sans text-xs text-ink-secondary">Choose the project for speed tests.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/projects"
              className="focus-ring rounded-lg border border-line-strong bg-surface-card px-3 py-1.5 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted"
            >
              Select / Manage
            </Link>
          </div>
        </div>
        <select
          id="speed-project"
          value={projectId ?? ''}
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            navigate(`/projects/${id}/speed`, { replace: location.pathname === '/speed' })
          }}
          disabled={projectsLoading || (!projectsLoading && projects.length === 0)}
          className="focus-ring mt-3 w-full rounded-lg border border-line bg-surface-muted/40 px-3 py-2 font-sans text-sm text-ink-primary disabled:opacity-60"
        >
          {projectsLoading ? (
            <option value="">Loading projects…</option>
          ) : projects.length === 0 ? (
            <option value="">No projects yet</option>
          ) : (
            <>
              {!projectId ? <option value="">Select a project…</option> : null}
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </>
          )}
        </select>
      </div>

      <div className={`mt-6 rounded-card border border-line bg-surface-card p-4 ${!projectId ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-primary">Start new test</h2>
            <p className="mt-0.5 font-sans text-xs text-ink-secondary">
              Credential status:{' '}
              {speedCredentialsConfigured ? (
                <span className="font-semibold text-semantic-success">Connected</span>
              ) : (
                <span className="font-semibold text-semantic-error">Not connected</span>
              )}
              {pageSpeedKeyConfigured ? ' · API key configured' : ''}
              {!pageSpeedKeyConfigured && tokenExpiry ? ` · OAuth expires ${new Date(tokenExpiry).toLocaleString()}` : ''}
            </p>
            {!speedCredentialsConfigured ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="font-sans text-xs text-ink-secondary">
                  Add a PageSpeed API key (or OAuth token) in <Link to="/settings" className="underline">Account settings</Link> first.
                </p>
                <button
                  type="button"
                  onClick={() => setShowOauthHelp(true)}
                  className="focus-ring rounded-md border border-line-strong bg-surface-card px-2 py-1 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted"
                >
                  How to connect
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <form
          className="mt-4 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!projectId) return
            const form = new FormData(e.currentTarget)
            const url = String(form.get('url') ?? '').trim()
            const strategy = (String(form.get('strategy') ?? 'mobile') === 'desktop' ? 'desktop' : 'mobile') as
              | 'mobile'
              | 'desktop'
            if (!url) return
            runMutation.mutate({ url, strategy })
          }}
        >
          <div className="min-w-[320px] flex-1">
            <label className="block font-sans text-xs font-semibold text-ink-secondary" htmlFor="speed-url">
              Page URL
            </label>
            <input
              id="speed-url"
              name="url"
              type="url"
              defaultValue={defaultUrl}
              required
              className="focus-ring mt-1 w-full rounded-lg border border-line px-3 py-2 font-sans text-sm text-ink-primary"
            />
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-ink-secondary" htmlFor="speed-strategy">
              Strategy
            </label>
            <select
              id="speed-strategy"
              name="strategy"
              defaultValue="mobile"
              className="focus-ring mt-1 rounded-lg border border-line px-3 py-2 font-sans text-sm text-ink-primary"
            >
              <option value="mobile">Mobile</option>
              <option value="desktop">Desktop</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!speedCredentialsConfigured || runMutation.isPending}
            className="focus-ring rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {runMutation.isPending ? 'Running…' : 'Run test'}
          </button>
        </form>
        {runMutation.error ? (
          <p className="mt-2 font-sans text-xs text-semantic-error">
            {runMutation.error instanceof ApiError ? runMutation.error.message : 'Could not run speed test'}
          </p>
        ) : null}
      </div>

      <div className={`mt-6 rounded-card border border-line bg-surface-card p-4 ${!projectId ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink-primary">Existing tests</h2>
          <button
            type="button"
            onClick={() => void refetch()}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-card px-3 py-1.5 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
        {tests.length === 0 ? (
          <p className="mt-3 font-sans text-xs text-ink-muted">No speed tests yet for this project.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tests.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-muted/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-sans text-sm text-ink-primary">{t.url}</p>
                  <p className="font-mono text-xs text-ink-secondary">
                    {new Date(t.fetchedAt).toLocaleString()} · {t.strategy}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-brand-primary/10 px-2 py-1 font-sans text-xs font-semibold text-brand-deep">
                    Perf {t.performanceScore ?? '—'}
                  </span>
                  <span className="rounded-md bg-surface-card px-2 py-1 font-sans text-xs font-semibold text-ink-secondary">
                    SEO {t.seoScore ?? '—'}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(t.id)}
                    disabled={deleteMutation.isPending}
                    className="focus-ring inline-flex items-center gap-1 rounded-md border border-line-strong bg-surface-card px-2 py-1 font-sans text-xs font-semibold text-semantic-error hover:bg-surface-muted disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showOauthHelp ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded-card border border-line bg-surface-card p-5 shadow-xl">
            <h3 className="font-display text-lg font-semibold text-ink-primary">
              Connect PageSpeed credentials
            </h3>
            <ol className="mt-3 list-decimal space-y-2 pl-5 font-sans text-sm text-ink-secondary">
              <li>
                Open Google Cloud Console and create/select a project. Enable <strong>PageSpeed Insights API</strong>.
              </li>
              <li>
                Create an <strong>API key</strong> and keep it restricted to PageSpeed Insights API.
              </li>
              <li>
                Go to <Link to="/settings" className="underline">Account settings</Link> and paste the key in the
                <strong> PageSpeed API key</strong> section.
              </li>
              <li>
                Click <strong>Save key</strong>, then click <strong>Test key</strong>.
              </li>
              <li>
                Optional: if needed, you can still use Google OAuth token as fallback.
              </li>
            </ol>
            <p className="mt-3 font-sans text-xs text-ink-muted">
              Tip: if tests fail, regenerate the API key and update it in settings.
            </p>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowOauthHelp(false)}
                className="focus-ring rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
