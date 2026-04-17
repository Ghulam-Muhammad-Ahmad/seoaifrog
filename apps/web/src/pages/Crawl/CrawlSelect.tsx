import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pause, Play, RefreshCw, Square } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { apiJson } from '@/lib/api'
import { useProject } from '@/contexts/ProjectContext'

type CrawlSessionRow = {
  id: string
  projectId: string
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  errorMessage: string | null
}

async function fetchCrawls(projectId: string): Promise<CrawlSessionRow[]> {
  try {
    return await apiJson<CrawlSessionRow[]>(`/api/projects/${projectId}/crawls`)
  } catch {
    return []
  }
}

export function CrawlSelect() {
  const { projectId: paramProjectId } = useParams<{ projectId?: string }>()
  const { selectedProjectId } = useProject()
  const projectId = paramProjectId ?? selectedProjectId
  const queryClient = useQueryClient()

  const {
    data: crawls = [],
    isFetching: crawlsFetching,
    refetch: refetchCrawls,
  } = useQuery({
    queryKey: ['project-crawls', projectId],
    queryFn: () => fetchCrawls(projectId!),
    enabled: Boolean(projectId),
    refetchInterval: (q) => {
      const active = (q.state.data ?? []).some((c) => c.status === 'RUNNING' || c.status === 'PENDING' || c.status === 'PAUSED')
      return active ? 3000 : false
    },
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['project-crawls', projectId] })
  }

  const pauseMutation = useMutation({
    mutationFn: async (id: string) => await apiJson(`/api/crawls/${id}/pause`, { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
  })
  const resumeMutation = useMutation({
    mutationFn: async (id: string) => await apiJson(`/api/crawls/${id}/resume`, { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
  })
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => await apiJson(`/api/crawls/${id}/cancel`, { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
  })

  const mutating = pauseMutation.isPending || resumeMutation.isPending || cancelMutation.isPending
  const projectReady = Boolean(projectId)
  const pendingCount = crawls.filter((c) => c.status === 'PENDING').length
  const runningCount = crawls.filter((c) => c.status === 'RUNNING').length
  const completedCount = crawls.filter((c) => c.status === 'COMPLETED').length
  const failedCount = crawls.filter((c) => c.status === 'FAILED' || c.status === 'CANCELLED').length

  const statusPill = (status: CrawlSessionRow['status']) => {
    if (status === 'COMPLETED') return 'bg-semantic-success-light text-semantic-success'
    if (status === 'FAILED' || status === 'CANCELLED') return 'bg-semantic-error-light text-semantic-error'
    if (status === 'RUNNING') return 'bg-brand-primary/15 text-brand-deep'
    if (status === 'PAUSED') return 'bg-amber-100 text-amber-700'
    return 'bg-surface-muted text-ink-secondary'
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-primary">Crawling</h1>
      <p className="mt-1 font-sans text-sm text-ink-secondary">Start new crawls and manage existing sessions.</p>

      {!projectReady ? (
        <div className="mt-6 rounded-card border border-dashed border-line bg-surface-muted/30 p-8 text-center">
          <p className="font-sans text-sm text-ink-secondary">Select a project from the header to get started.</p>
        </div>
      ) : null}

      <div className={`mt-6 rounded-card border border-line bg-surface-card p-4 ${!projectReady ? 'pointer-events-none opacity-50' : ''}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink-primary">Existing crawls</h2>
            <p className="mt-0.5 font-sans text-xs text-ink-secondary">
              Pending {pendingCount} · Running {runningCount} · Completed {completedCount} · Failed/Canceled {failedCount}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {projectId ? (
              <Link
                to={`/projects/${projectId}/crawl/config`}
                className="focus-ring rounded-lg bg-brand-primary px-3 py-1.5 font-sans text-xs font-semibold text-white hover:bg-brand-primary-hover"
              >
                Start new crawl
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void refetchCrawls()}
              className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-card px-3 py-1.5 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${crawlsFetching ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </button>
          </div>
        </div>

        {crawls.length === 0 ? (
          <p className="mt-3 font-sans text-xs text-ink-muted">No crawl sessions for this project yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {crawls.slice(0, 20).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-muted/30 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-ink-primary">
                    {new Date(c.createdAt).toLocaleString()} · {c.id.slice(0, 8)}…
                  </p>
                  {c.errorMessage ? (
                    <p className="mt-0.5 font-sans text-xs text-semantic-error">{c.errorMessage}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-2 py-0.5 font-sans text-xs font-semibold ${statusPill(c.status)}`}>
                    {c.status}
                  </span>
                  {projectId ? (
                    <Link
                      to={`/projects/${projectId}/crawl/${c.id}`}
                      className="focus-ring rounded-md border border-line-strong bg-surface-card px-2 py-1 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted"
                    >
                      Open
                    </Link>
                  ) : null}
                  {c.status === 'RUNNING' ? (
                    <button
                      type="button"
                      onClick={() => pauseMutation.mutate(c.id)}
                      disabled={mutating}
                      className="focus-ring inline-flex items-center gap-1 rounded-md border border-line-strong bg-surface-card px-2 py-1 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-60"
                    >
                      <Pause className="h-3.5 w-3.5" aria-hidden />
                      Pause
                    </button>
                  ) : null}
                  {c.status === 'PAUSED' ? (
                    <button
                      type="button"
                      onClick={() => resumeMutation.mutate(c.id)}
                      disabled={mutating}
                      className="focus-ring inline-flex items-center gap-1 rounded-md border border-line-strong bg-surface-card px-2 py-1 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-60"
                    >
                      <Play className="h-3.5 w-3.5" aria-hidden />
                      Resume
                    </button>
                  ) : null}
                  {(c.status === 'PENDING' || c.status === 'RUNNING' || c.status === 'PAUSED') ? (
                    <button
                      type="button"
                      onClick={() => cancelMutation.mutate(c.id)}
                      disabled={mutating}
                      className="focus-ring inline-flex items-center gap-1 rounded-md border border-line-strong bg-surface-card px-2 py-1 font-sans text-xs font-semibold text-semantic-error hover:bg-surface-muted disabled:opacity-60"
                    >
                      <Square className="h-3.5 w-3.5" aria-hidden />
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
