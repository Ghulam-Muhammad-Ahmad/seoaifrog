import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, ArrowLeft, Download } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import type { ReportDTO } from '@seoaifrog/shared'
import { ReportMarkdownPreview } from '@/components/reports/ReportMarkdownPreview'
import { apiFetch, apiJson, ApiError } from '@/lib/api'
import { exportReportFile } from '@/lib/reportExport'
import { useState } from 'react'

async function fetchReportMeta(reportId: string): Promise<ReportDTO> {
  return await apiJson<ReportDTO>(`/api/reports/${reportId}`)
}

async function fetchReportMarkdown(reportId: string): Promise<string> {
  const res = await apiFetch(`/api/reports/${reportId}/download`)
  if (!res.ok) throw new Error('Failed to load report')
  return res.text()
}

async function patchReportArchived(reportId: string, archived: boolean): Promise<ReportDTO> {
  return await apiJson<ReportDTO>(`/api/reports/${reportId}`, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  })
}

export function ReportDetail() {
  const { projectId, reportId } = useParams<{ projectId: string; reportId: string }>()
  const pid = projectId ?? ''
  const rid = reportId ?? ''
  const [exportError, setExportError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: meta, isLoading: metaLoading, error: metaError } = useQuery({
    queryKey: ['report', rid],
    queryFn: () => fetchReportMeta(rid),
    enabled: Boolean(rid),
    retry: false,
  })

  const {
    data: markdown = '',
    isLoading: mdLoading,
    error: mdError,
  } = useQuery({
    queryKey: ['report-md', rid],
    queryFn: () => fetchReportMarkdown(rid),
    enabled: Boolean(rid && meta),
  })

  const archiveMutation = useMutation({
    mutationFn: ({ archived }: { archived: boolean }) => patchReportArchived(rid, archived),
    onSuccess: (updated) => {
      void queryClient.setQueryData<ReportDTO>(['report', rid], updated)
      void queryClient.invalidateQueries({ queryKey: ['reports', pid] })
    },
  })

  if (!pid || !rid) {
    return <p className="font-sans text-sm text-semantic-error">Missing route params.</p>
  }

  if (metaLoading) {
    return <p className="font-sans text-sm text-ink-muted">Loading report…</p>
  }

  if (metaError) {
    return (
      <p className="font-sans text-sm text-semantic-error">
        {metaError instanceof ApiError ? metaError.message : 'Failed to load report.'}
      </p>
    )
  }

  if (!meta) {
    return <p className="font-sans text-sm text-ink-secondary">Report not found.</p>
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to={`/projects/${pid}/reports`}
            className="focus-ring inline-flex items-center gap-1 font-sans text-sm font-semibold text-brand-primary hover:text-brand-primary-hover"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Reports
          </Link>
          <h1 className="font-display text-2xl font-bold text-ink-primary">{meta.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {meta.archived ? (
            <span className="rounded-badge border border-line-strong bg-surface-muted px-2 py-0.5 font-sans text-xs font-semibold text-ink-secondary">
              Archived
            </span>
          ) : null}
          {meta.overallScore != null ? (
            <span className="rounded-badge bg-brand-primary-light px-2 py-0.5 font-mono text-xs font-semibold text-brand-deep">
              Score {meta.overallScore}
            </span>
          ) : null}
          {meta.archived ? (
            <button
              type="button"
              disabled={archiveMutation.isPending}
              onClick={() => archiveMutation.mutate({ archived: false })}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 font-sans text-sm font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-60"
            >
              <ArchiveRestore className="h-4 w-4" aria-hidden />
              Restore
            </button>
          ) : (
            <button
              type="button"
              disabled={archiveMutation.isPending}
              onClick={() => archiveMutation.mutate({ archived: true })}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line-strong px-4 py-2 font-sans text-sm font-semibold text-ink-secondary hover:bg-surface-muted disabled:opacity-60"
            >
              <Archive className="h-4 w-4" aria-hidden />
              Archive
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setExportError(null)
              void exportReportFile(rid, meta.title).catch(() => setExportError('Export failed'))
            }}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export .md
          </button>
        </div>
      </div>
      <p className="mt-2 font-mono text-xs text-ink-muted">
        {meta.format} · {new Date(meta.createdAt).toLocaleString()}
      </p>
      {exportError ? <p className="mt-2 font-sans text-xs text-semantic-error">{exportError}</p> : null}

      <div className="mt-8">
        <h2 className="font-display text-sm font-semibold text-ink-primary">Preview</h2>
        <p className="mt-1 font-sans text-xs text-ink-secondary">
          {meta.format === 'markdown' ? 'Rendered from Markdown.' : 'Legacy HTML report.'}
        </p>
        {mdLoading ? (
          <p className="mt-4 font-sans text-sm text-ink-muted">Loading preview…</p>
        ) : mdError ? (
          <p className="mt-4 font-sans text-sm text-semantic-error">Could not load report body.</p>
        ) : meta.format === 'markdown' ? (
          <div className="mt-4">
            <ReportMarkdownPreview markdown={markdown} />
          </div>
        ) : (
          <iframe
            title="Report preview"
            className="mt-4 h-[min(70vh,720px)] w-full rounded-lg border border-line bg-white"
            sandbox="allow-same-origin"
            srcDoc={markdown}
          />
        )}
      </div>
    </div>
  )
}
