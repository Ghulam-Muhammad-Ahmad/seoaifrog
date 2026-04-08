import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Download, Loader2, XCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { AuditDTO, ReportCreatedDTO } from '@seoaifrog/shared'
import { ReportMarkdownPreview } from '@/components/reports/ReportMarkdownPreview'
import { ApiError, apiJson } from '@/lib/api'
import { downloadMarkdownString, markdownExportFilename } from '@/lib/reportExport'

async function fetchAudit(auditId: string): Promise<AuditDTO | null> {
  try {
    return await apiJson<AuditDTO>(`/api/audits/${auditId}`)
  } catch {
    return null
  }
}

export function AuditProgress() {
  const { projectId, auditId } = useParams<{ projectId: string; auditId: string }>()
  const pid = projectId ?? ''
  const aid = auditId ?? ''
  const queryClient = useQueryClient()
  const [reportError, setReportError] = useState<string | null>(null)

  const generateReport = useMutation({
    mutationFn: () =>
      apiJson<ReportCreatedDTO>(`/api/projects/${pid}/reports`, {
        method: 'POST',
        body: JSON.stringify({ auditId: aid }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports', pid] })
      setReportError(null)
    },
    onError: (e: unknown) => {
      setReportError(e instanceof ApiError ? e.message : 'Failed to generate report')
    },
  })

  const { data: audit, isLoading } = useQuery({
    queryKey: ['audit', aid],
    queryFn: () => fetchAudit(aid),
    enabled: Boolean(pid && aid),
    refetchInterval: (q) => {
      const a = q.state.data
      if (!a || a.status === 'COMPLETED' || a.status === 'FAILED') return false
      return 2000
    },
  })

  if (!pid || !aid) {
    return <p className="font-sans text-sm text-semantic-error">Missing route params.</p>
  }

  if (isLoading && !audit) {
    return (
      <div className="flex items-center gap-2 font-sans text-sm text-ink-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading audit…
      </div>
    )
  }

  if (!audit) {
    return <p className="font-sans text-sm text-ink-secondary">Audit not found.</p>
  }

  const done = audit.status === 'COMPLETED'
  const failed = audit.status === 'FAILED'

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-primary">Audit progress</h1>
          <p className="mt-1 font-mono text-xs text-ink-muted">Audit {audit.id}</p>
        </div>
        <Link
          to={`/projects/${pid}/reports`}
          className="focus-ring font-sans text-sm font-semibold text-brand-primary hover:text-brand-primary-hover"
        >
          Reports →
        </Link>
      </div>

      <div className="mt-6 rounded-card border border-line bg-surface-card p-6">
        <div className="flex items-center gap-2">
          {done ? (
            <CheckCircle2 className="h-5 w-5 text-semantic-success" aria-hidden />
          ) : failed ? (
            <XCircle className="h-5 w-5 text-semantic-error" aria-hidden />
          ) : (
            <Loader2 className="h-5 w-5 animate-spin text-brand-primary" aria-hidden />
          )}
          <span className="font-sans text-sm font-semibold text-ink-primary">{audit.status}</span>
          {audit.overallScore != null ? (
            <span className="ml-2 font-mono text-sm text-brand-deep">Score: {audit.overallScore}</span>
          ) : null}
        </div>
        {audit.errorMessage ? (
          <p className="mt-3 font-sans text-sm text-semantic-error">{audit.errorMessage}</p>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-line bg-surface-muted/30 px-3 py-2">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Input source</p>
            <p className="mt-1 font-sans text-sm text-ink-primary">
              {audit.targetUrl ? 'Specific URL' : audit.crawlSessionId ? 'Crawl session' : 'Project only'}
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface-muted/30 px-3 py-2">
            <p className="font-sans text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Scope</p>
            <p className="mt-1 break-all font-mono text-xs text-ink-primary">
              {audit.targetUrl ?? (audit.crawlSessionId ? `crawl:${audit.crawlSessionId}` : 'No crawl selected')}
            </p>
          </div>
        </div>

        {done ? (
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              disabled={generateReport.isPending || generateReport.isSuccess}
              onClick={() => generateReport.mutate()}
              className="focus-ring rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
            >
              {generateReport.isPending ? 'Generating…' : generateReport.isSuccess ? 'Report generated ✓' : 'Generate report'}
            </button>
            {generateReport.isSuccess && generateReport.data ? (
              <>
                <Link
                  to={`/projects/${pid}/reports/${generateReport.data.id}`}
                  className="focus-ring font-sans text-sm font-semibold text-brand-primary hover:text-brand-primary-hover"
                >
                  Open full page →
                </Link>
                <Link
                  to={`/projects/${pid}/reports`}
                  className="focus-ring font-sans text-sm text-ink-secondary hover:text-brand-primary"
                >
                  All reports
                </Link>
              </>
            ) : null}
            {reportError ? <p className="font-sans text-xs text-semantic-error">{reportError}</p> : null}
          </div>
        ) : null}

        {done && generateReport.isSuccess && generateReport.data?.markdown ? (
          <div className="mt-8 border-t border-line pt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink-primary">Report preview</h2>
                <p className="mt-0.5 font-sans text-xs text-ink-secondary">Markdown rendered below. Export saves a .md file.</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  downloadMarkdownString(
                    markdownExportFilename(generateReport.data!.title, generateReport.data!.id),
                    generateReport.data!.markdown,
                  )
                }
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line-strong bg-surface-card px-4 py-2 font-sans text-sm font-semibold text-ink-primary hover:bg-surface-muted"
              >
                <Download className="h-4 w-4" aria-hidden />
                Export .md
              </button>
            </div>
            <div className="mt-4">
              <ReportMarkdownPreview markdown={generateReport.data.markdown} />
            </div>
          </div>
        ) : null}

        <ul className="mt-6 space-y-2">
          {(audit.skillResults ?? []).map((s) => (
            <li
              key={s.id}
              className="flex items-center justify-between rounded-lg border border-line bg-surface-muted/40 px-3 py-2 font-sans text-sm"
            >
              <span className="font-mono text-xs">{s.skillName}</span>
              <span className="text-ink-secondary">{s.status}</span>
              {s.score != null ? <span className="font-mono text-xs font-medium">{s.score}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
