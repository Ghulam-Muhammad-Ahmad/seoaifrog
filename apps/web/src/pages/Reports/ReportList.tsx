import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Eye, FileDown } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ReportDTO } from '@seoaifrog/shared'
import { apiJson } from '@/lib/api'
import { exportReportFile } from '@/lib/reportExport'

type ReportView = 'active' | 'archived'

async function fetchReports(projectId: string, view: ReportView): Promise<ReportDTO[]> {
  try {
    const q = view === 'archived' ? '?view=archived' : '?view=active'
    return await apiJson<ReportDTO[]>(`/api/projects/${projectId}/reports${q}`)
  } catch {
    return []
  }
}

async function patchReportArchived(reportId: string, archived: boolean): Promise<ReportDTO> {
  return await apiJson<ReportDTO>(`/api/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  })
}

export function ReportList() {
  const { projectId } = useParams<{ projectId: string }>()
  const id = projectId ?? ''
  const [exportingId, setExportingId] = useState<string | null>(null)
  const [view, setView] = useState<ReportView>('active')
  const queryClient = useQueryClient()

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['reports', id, view],
    queryFn: () => fetchReports(id, view),
    enabled: Boolean(id),
  })

  const archiveMutation = useMutation({
    mutationFn: ({ reportId, archived }: { reportId: string; archived: boolean }) =>
      patchReportArchived(reportId, archived),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports', id] })
    },
  })

  if (!id) {
    return <p className="font-sans text-sm text-semantic-error">Missing project.</p>
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-primary">Reports</h1>
          <p className="mt-1 font-sans text-sm text-ink-secondary">Exports tied to audits and crawls.</p>
        </div>
        <Link
          to={`/projects/${id}`}
          className="focus-ring font-sans text-sm font-semibold text-brand-primary hover:text-brand-primary-hover"
        >
          ← Project
        </Link>
      </div>

      <div
        className="mt-6 inline-flex rounded-lg border border-line bg-surface-muted p-0.5"
        role="tablist"
        aria-label="Report list view"
      >
        <button
          type="button"
          role="tab"
          aria-selected={view === 'active'}
          onClick={() => setView('active')}
          className={`rounded-md px-3 py-1.5 font-sans text-xs font-semibold transition-colors ${
            view === 'active'
              ? 'bg-surface-card text-ink-primary shadow-sm'
              : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          Active
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'archived'}
          onClick={() => setView('archived')}
          className={`rounded-md px-3 py-1.5 font-sans text-xs font-semibold transition-colors ${
            view === 'archived'
              ? 'bg-surface-card text-ink-primary shadow-sm'
              : 'text-ink-secondary hover:text-ink-primary'
          }`}
        >
          Archived
        </button>
      </div>

      <div className="mt-8 rounded-card border border-line bg-surface-card">
        {isLoading ? (
          <p className="p-6 font-sans text-sm text-ink-muted">Loading reports…</p>
        ) : reports.length === 0 ? (
          <p className="p-6 font-sans text-sm text-ink-secondary">
            {view === 'archived'
              ? 'No archived reports.'
              : 'No reports yet. Complete an audit to generate one.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                <div>
                  <Link
                    to={`/projects/${id}/reports/${r.id}`}
                    className="focus-ring font-sans text-sm font-semibold text-ink-primary hover:text-brand-deep"
                  >
                    {r.title}
                  </Link>
                  <p className="mt-0.5 font-mono text-xs text-ink-muted">
                    {r.format} · {new Date(r.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {r.overallScore != null ? (
                    <span className="rounded-badge bg-brand-primary-light px-2 py-0.5 font-mono text-xs font-semibold text-brand-deep">
                      {r.overallScore}
                    </span>
                  ) : null}
                  <Link
                    to={`/projects/${id}/reports/${r.id}`}
                    className="focus-ring inline-flex items-center gap-1 rounded-lg border border-line-strong px-3 py-1.5 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted"
                  >
                    <Eye className="h-3.5 w-3.5" aria-hidden />
                    Preview
                  </Link>
                  <button
                    type="button"
                    disabled={exportingId === r.id}
                    onClick={() => {
                      setExportingId(r.id)
                      void exportReportFile(r.id, r.title)
                        .catch(() => {})
                        .finally(() => setExportingId(null))
                    }}
                    className="focus-ring inline-flex items-center gap-1 rounded-lg bg-brand-primary px-3 py-1.5 font-sans text-xs font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
                  >
                    <FileDown className="h-3.5 w-3.5" aria-hidden />
                    {exportingId === r.id ? '…' : 'Export'}
                  </button>
                  {view === 'active' ? (
                    <button
                      type="button"
                      disabled={archiveMutation.isPending}
                      onClick={() => archiveMutation.mutate({ reportId: r.id, archived: true })}
                      className="focus-ring inline-flex items-center gap-1 rounded-lg border border-line-strong px-3 py-1.5 font-sans text-xs font-semibold text-ink-secondary hover:bg-surface-muted disabled:opacity-60"
                      title="Archive report"
                    >
                      <Archive className="h-3.5 w-3.5" aria-hidden />
                      Archive
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={archiveMutation.isPending}
                      onClick={() => archiveMutation.mutate({ reportId: r.id, archived: false })}
                      className="focus-ring inline-flex items-center gap-1 rounded-lg border border-line-strong px-3 py-1.5 font-sans text-xs font-semibold text-ink-secondary hover:bg-surface-muted disabled:opacity-60"
                      title="Restore to active list"
                    >
                      <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />
                      Restore
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
