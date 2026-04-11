import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  ExternalLink,
  Pause,
  Play,
  RefreshCw,
  Search,
  Square,
  X,
} from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import type { CrawledPageDTO, CrawledPageDetailDTO } from '@seoaifrog/shared'
import { ApiError, apiJson } from '@/lib/api'

type PagesResponse = { data: CrawledPageDTO[]; total: number; page: number; pageSize: number }

type CrawlSessionDTO = {
  id: string
  status: string
  stats: unknown
  errorMessage: string | null
}

async function fetchCrawl(crawlId: string): Promise<CrawlSessionDTO | null> {
  try {
    return await apiJson<CrawlSessionDTO>(`/api/crawls/${crawlId}`)
  } catch {
    return null
  }
}

async function fetchPages(crawlId: string): Promise<PagesResponse> {
  return await apiJson<PagesResponse>(`/api/crawls/${crawlId}/pages?page=1&pageSize=200`)
}

function isErrorStatusCode(code: number | null | undefined): boolean {
  if (code == null || code === 0) return true
  return code >= 400
}

type SortKey = 'statusCode' | 'url' | 'title' | 'crawlDepth' | 'responseTimeMs' | 'hasSchema'

function compareNum(a: number | null | undefined, b: number | null | undefined, dir: number): number {
  const aN = a == null ? Number.POSITIVE_INFINITY : a
  const bN = b == null ? Number.POSITIVE_INFINITY : b
  if (aN < bN) return -dir
  if (aN > bN) return dir
  return 0
}

/** true > false > null for ascending */
function compareSchema(a: boolean | null | undefined, b: boolean | null | undefined, dir: number): number {
  const score = (v: boolean | null | undefined) => (v === true ? 2 : v === false ? 1 : 0)
  return (score(a) - score(b)) * dir
}

function SortableTh({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string
  column: SortKey
  sortKey: SortKey | null
  sortDir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const active = sortKey === column
  return (
    <th
      scope="col"
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="px-1 py-1 font-semibold text-ink-secondary"
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="focus-ring flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-left hover:bg-surface-muted"
      >
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0 text-brand-primary" aria-hidden />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0 text-brand-primary" aria-hidden />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
        )}
      </button>
    </th>
  )
}

function exportCsv(pages: CrawledPageDTO[], crawlId: string) {
  const headers = ['status', 'url', 'title', 'depth', 'ms', 'indexable', 'words', 'has_json_ld']
  const rows = pages.map((p) => [
    p.statusCode ?? '',
    p.url,
    (p.title ?? '').replace(/"/g, '""'),
    p.crawlDepth ?? '',
    p.responseTimeMs ?? '',
    p.indexable ?? '',
    p.wordCount ?? '',
    p.hasSchema === true ? 'yes' : p.hasSchema === false ? 'no' : '',
  ])
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `crawl-${crawlId.slice(-8)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function fmt(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

function prettyJsonLd(raw: string | null): string {
  if (!raw) return ''
  try {
    return JSON.stringify(JSON.parse(raw) as unknown, null, 2)
  } catch {
    return raw
  }
}

function PageDetailModal({
  crawlId,
  pageId,
  onClose,
}: {
  crawlId: string
  pageId: string
  onClose: () => void
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['crawl-page-detail', crawlId, pageId],
    queryFn: () => apiJson<CrawledPageDetailDTO>(`/api/crawls/${crawlId}/pages/${pageId}`),
    enabled: Boolean(crawlId && pageId),
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const errMsg = error instanceof ApiError ? error.message : error ? 'Failed to load' : null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="crawl-page-detail-title"
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-line bg-surface-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line bg-surface-muted/50 px-4 py-3">
          <h2 id="crawl-page-detail-title" className="font-display text-lg font-bold text-ink-primary">
            Page details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-lg p-1.5 text-ink-secondary hover:bg-surface-muted hover:text-ink-primary"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <p className="font-sans text-sm text-ink-muted">Loading…</p>
          ) : errMsg ? (
            <p className="font-sans text-sm text-semantic-error">{errMsg}</p>
          ) : data ? (
            <div className="space-y-5 font-sans text-sm">
              <div>
                <a
                  href={data.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring inline-flex max-w-full items-center gap-1 break-all font-mono text-xs font-semibold text-brand-primary hover:underline"
                >
                  {data.url}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                </a>
              </div>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold text-ink-secondary">HTTP status</dt>
                  <dd className="font-mono text-ink-primary">{fmt(data.statusCode)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-secondary">Content-Type</dt>
                  <dd className="break-all font-mono text-xs text-ink-primary">{fmt(data.contentType)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-secondary">Response time</dt>
                  <dd className="font-mono text-ink-primary">
                    {data.responseTimeMs != null ? `${data.responseTimeMs} ms` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-secondary">HTML size</dt>
                  <dd className="font-mono text-ink-primary">{fmt(data.htmlSize)} bytes</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-secondary">Crawl depth</dt>
                  <dd className="font-mono text-ink-primary">{fmt(data.crawlDepth)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-secondary">Indexable</dt>
                  <dd className="text-ink-primary">
                    {data.indexable === null ? '—' : data.indexable ? 'Yes' : 'No'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-secondary">Crawled at</dt>
                  <dd className="text-ink-primary">{new Date(data.crawledAt).toLocaleString()}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-ink-secondary">JSON-LD</dt>
                  <dd className="text-ink-primary">
                    {data.hasSchema === true ? (
                      <span className="font-medium text-semantic-success">Yes</span>
                    ) : data.hasSchema === false ? (
                      <span className="text-ink-secondary">No</span>
                    ) : (
                      '—'
                    )}
                  </dd>
                </div>
                {data.schemaTypes ? (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold text-ink-secondary">Schema.org @types</dt>
                    <dd className="mt-0.5 font-mono text-xs text-ink-primary">{data.schemaTypes}</dd>
                  </div>
                ) : null}
              </dl>

              <div>
                <h3 className="font-semibold text-ink-primary">On-page SEO</h3>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-semibold text-ink-secondary">Title</dt>
                    <dd className="text-ink-primary">{data.title ?? '—'}</dd>
                    <dd className="text-xs text-ink-muted">Length: {fmt(data.titleLength)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink-secondary">Meta description</dt>
                    <dd className="text-ink-primary">{data.metaDescription ?? '—'}</dd>
                    <dd className="text-xs text-ink-muted">Length: {fmt(data.metaDescLength)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink-secondary">OG title</dt>
                    <dd className="text-ink-primary">{data.ogTitle ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink-secondary">OG description</dt>
                    <dd className="text-ink-primary">{data.ogDescription ?? '—'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-semibold text-ink-secondary">OG image</dt>
                    <dd className="break-all text-ink-primary">{data.ogImage ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink-secondary">H1</dt>
                    <dd className="text-ink-primary">{data.h1Text ?? '—'}</dd>
                    <dd className="text-xs text-ink-muted">Count: {fmt(data.h1Count)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink-secondary">H2</dt>
                    <dd className="text-ink-primary">—</dd>
                    <dd className="text-xs text-ink-muted">Count: {fmt(data.h2Count)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-ink-secondary">Word count</dt>
                    <dd className="font-mono text-ink-primary">{fmt(data.wordCount)}</dd>
                  </div>
                </dl>
              </div>

              {data.headings.length > 0 ? (
                <div>
                  <h3 className="font-semibold text-ink-primary">Heading structure</h3>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Extracted in DOM order from H1-H6 tags.
                  </p>
                  <ul className="mt-2 max-h-52 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface-muted/30 p-3 text-xs">
                    {data.headings.slice(0, 300).map((h, i) => (
                      <li key={`${h.level}-${i}`} className="break-words font-mono text-ink-primary">
                        {`H${h.level}: ${h.text}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {data.schemaJson ? (
                <div>
                  <h3 className="font-semibold text-ink-primary">JSON-LD (stored)</h3>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    Parsed from &lt;script type=&quot;application/ld+json&quot;&gt; blocks (may be truncated for very large payloads).
                  </p>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-line bg-surface-muted/30 p-3 font-mono text-[11px] leading-relaxed text-ink-primary">
                    {prettyJsonLd(data.schemaJson)}
                  </pre>
                </div>
              ) : data.hasSchema === false ? (
                <div className="rounded-lg border border-line bg-surface-muted/30 px-3 py-2 text-xs text-ink-secondary">
                  No <code className="rounded bg-surface-muted px-1">application/ld+json</code> blocks were found on
                  this page.
                </div>
              ) : null}

              <div>
                <h3 className="font-semibold text-ink-primary">Links (extracted)</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Internal: {fmt(data.internalLinks)} · External: {fmt(data.externalLinks)} · Stored:{' '}
                  {data.links.length}
                </p>
                {data.links.length > 0 ? (
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface-muted/30 p-2 text-xs">
                    {data.links.slice(0, 200).map((link, i) => (
                      <li key={`${link.href}-${i}`} className="break-all font-mono">
                        <span className={link.isInternal ? 'text-brand-deep' : 'text-ink-secondary'}>
                          [{link.isInternal ? 'in' : 'out'}]
                        </span>{' '}
                        {link.href}
                        {link.text ? (
                          <span className="block pl-4 font-sans text-ink-muted">“{link.text}”</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              {data.issues.length > 0 ? (
                <div>
                  <h3 className="font-semibold text-ink-primary">Issues</h3>
                  <ul className="mt-2 space-y-2">
                    {data.issues.map((iss) => (
                      <li
                        key={`${iss.code}-${iss.message}`}
                        className="rounded-lg border border-line bg-surface-muted/30 px-3 py-2 text-xs"
                      >
                        <span className="font-mono font-semibold text-ink-primary">{iss.code}</span>
                        <span className="text-ink-muted"> · {iss.severity}</span>
                        <p className="mt-0.5 text-ink-secondary">{iss.message}</p>
                        {iss.detail ? <p className="mt-1 font-mono text-ink-muted">{iss.detail}</p> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export function CrawlView() {
  const { projectId, crawlId } = useParams<{ projectId: string; crawlId: string }>()
  const pid = projectId ?? ''
  const cid = crawlId ?? ''
  const queryClient = useQueryClient()
  const [refreshPending, setRefreshPending] = useState(false)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [detailPageId, setDetailPageId] = useState<string | null>(null)

  const { data: crawl } = useQuery({
    queryKey: ['crawl', cid],
    queryFn: () => fetchCrawl(cid),
    enabled: Boolean(cid),
    refetchInterval: (q) => {
      const s = q.state.data?.status
      if (s === 'RUNNING' || s === 'PENDING' || s === 'PAUSED') return 2000
      return false
    },
  })

  const crawlActive = crawl?.status === 'RUNNING' || crawl?.status === 'PENDING' || crawl?.status === 'PAUSED'

  const { data: pagesRes, isLoading, refetch } = useQuery({
    queryKey: ['crawl-pages', cid],
    queryFn: () => fetchPages(cid),
    enabled: Boolean(cid),
    refetchInterval: crawlActive ? 2000 : false,
  })

  const pages = pagesRes?.data ?? []

  const filteredPages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pages
    return pages.filter((p) => {
      const schemaLabel =
        p.hasSchema === true ? 'yes json-ld schema' : p.hasSchema === false ? 'no schema' : ''
      const blob = [
        p.url,
        p.title ?? '',
        String(p.statusCode ?? ''),
        String(p.crawlDepth ?? ''),
        String(p.responseTimeMs ?? ''),
        schemaLabel,
      ]
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [pages, search])

  const displayedPages = useMemo(() => {
    if (!sortKey) return filteredPages
    const dir = sortDir === 'asc' ? 1 : -1
    const list = [...filteredPages]
    list.sort((a, b) => {
      switch (sortKey) {
        case 'statusCode':
          return compareNum(a.statusCode, b.statusCode, dir)
        case 'url':
          return a.url.localeCompare(b.url) * dir
        case 'title':
          return (a.title ?? '').localeCompare(b.title ?? '', undefined, { sensitivity: 'base' }) * dir
        case 'crawlDepth':
          return (a.crawlDepth - b.crawlDepth) * dir
        case 'responseTimeMs':
          return compareNum(a.responseTimeMs, b.responseTimeMs, dir)
        case 'hasSchema':
          return compareSchema(a.hasSchema, b.hasSchema, dir)
        default:
          return 0
      }
    })
    return list
  }, [filteredPages, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleRefresh = () => {
    setRefreshPending(true)
    void Promise.all([
      refetch(),
      queryClient.refetchQueries({ queryKey: ['crawl', cid] }),
    ]).finally(() => setRefreshPending(false))
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['crawl', cid] })
  }

  const pauseMutation = useMutation({
    mutationFn: () => apiJson(`/api/crawls/${cid}/pause`, { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
  })

  const resumeMutation = useMutation({
    mutationFn: () => apiJson(`/api/crawls/${cid}/resume`, { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
  })

  const cancelMutation = useMutation({
    mutationFn: () => apiJson(`/api/crawls/${cid}/cancel`, { method: 'POST', body: '{}' }),
    onSuccess: invalidate,
  })

  const status = crawl?.status ?? ''
  const isRunning = status === 'RUNNING'
  const isPaused = status === 'PAUSED'
  const isPending = status === 'PENDING'
  const isFinished = status === 'COMPLETED' || status === 'CANCELLED' || status === 'FAILED'
  const mutating = pauseMutation.isPending || resumeMutation.isPending || cancelMutation.isPending

  if (!pid || !cid) {
    return <p className="font-sans text-sm text-semantic-error">Missing project or crawl id.</p>
  }

  return (
    <>
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-primary">Crawl results</h1>
          <p className="mt-1 font-sans text-sm text-ink-secondary">
            Session{' '}
            <code className="rounded bg-surface-muted px-1 font-mono text-xs">{cid}</code>
            {crawl ? (
              <>
                {' '}
                · <span className="font-mono text-xs">{crawl.status}</span>
              </>
            ) : null}
            {pagesRes != null ? (
              <>
                {' '}
                · {pagesRes.total} URL{pagesRes.total === 1 ? '' : 's'}
              </>
            ) : null}
          </p>
        </div>
        <Link
          to={`/projects/${pid}/crawl/config`}
          className="focus-ring font-sans text-sm font-semibold text-brand-primary hover:text-brand-primary-hover"
        >
          New crawl
        </Link>
      </div>

      {crawl?.errorMessage ? (
        <p className="mt-3 font-sans text-sm text-semantic-error">{crawl.errorMessage}</p>
      ) : null}

      {(pauseMutation.error || resumeMutation.error || cancelMutation.error) ? (
        <p className="mt-2 font-sans text-xs text-semantic-error">
          {pauseMutation.error instanceof ApiError ? pauseMutation.error.message
            : resumeMutation.error instanceof ApiError ? resumeMutation.error.message
            : cancelMutation.error instanceof ApiError ? (cancelMutation.error as ApiError).message
            : 'Action failed'}
        </p>
      ) : null}

      {pages.length > 0 ? (
        <div className="mt-6">
          <label htmlFor="crawl-table-search" className="sr-only">
            Filter crawl rows
          </label>
          <div className="relative max-w-md">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
              aria-hidden
            />
            <input
              id="crawl-table-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search URL, title, status, schema, depth, ms…"
              className="focus-ring w-full rounded-lg border border-line-strong bg-surface-card py-2 pl-9 pr-3 font-sans text-sm text-ink-primary placeholder:text-ink-muted"
            />
          </div>
          {search.trim() ? (
            <p className="mt-2 font-sans text-xs text-ink-secondary">
              Showing {displayedPages.length} of {pages.length} URL{pages.length === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-muted/50 px-3 py-2">
        {/* Resume: show when paused */}
        {isPaused ? (
          <button
            type="button"
            disabled={mutating}
            onClick={() => resumeMutation.mutate()}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-brand-primary/40 bg-surface-card px-3 py-1.5 font-sans text-xs font-semibold text-brand-primary hover:bg-surface-muted disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            Resume
          </button>
        ) : null}

        {/* Pause: show when running */}
        {isRunning ? (
          <button
            type="button"
            disabled={mutating}
            onClick={() => pauseMutation.mutate()}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-card px-3 py-1.5 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-50"
          >
            <Pause className="h-3.5 w-3.5" aria-hidden />
            Pause
          </button>
        ) : null}

        {/* Cancel: show when active */}
        {(isRunning || isPaused || isPending) ? (
          <button
            type="button"
            disabled={mutating}
            onClick={() => {
              if (confirm('Cancel this crawl?')) cancelMutation.mutate()
            }}
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-card px-3 py-1.5 font-sans text-xs font-semibold text-semantic-error hover:bg-surface-muted disabled:opacity-50"
          >
            <Square className="h-3.5 w-3.5" aria-hidden />
            Cancel
          </button>
        ) : null}

        {/* Refresh */}
        <button
          type="button"
          disabled={refreshPending}
          aria-busy={refreshPending}
          onClick={handleRefresh}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface-card px-3 py-1.5 font-sans text-xs font-semibold text-ink-primary hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-60"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 shrink-0 ${refreshPending ? 'animate-spin' : ''}`}
            aria-hidden
          />
          Refresh
        </button>

        {/* Export CSV: show when there are pages */}
        {pages.length > 0 ? (
          <button
            type="button"
            onClick={() => exportCsv(pages, cid)}
            className="focus-ring ml-auto inline-flex items-center gap-1.5 rounded-lg border border-transparent px-3 py-1.5 font-sans text-xs font-semibold text-ink-secondary hover:bg-surface-card"
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Export CSV
          </button>
        ) : (
          <span className="ml-auto" />
        )}
      </div>

      <div className="mt-4 flex-1 overflow-auto rounded-card border border-line bg-surface-card">
        {isLoading ? (
          <p className="p-4 font-sans text-sm text-ink-muted">Loading rows…</p>
        ) : pages.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-sans text-sm text-ink-secondary">No pages in this crawl yet.</p>
            <p className="mt-1 font-sans text-xs text-ink-muted">
              {isFinished ? 'Crawl finished with no pages recorded.' : 'Rows will appear as the worker discovers URLs.'}
            </p>
          </div>
        ) : displayedPages.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-sans text-sm text-ink-secondary">No rows match your search.</p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="focus-ring mt-3 font-sans text-xs font-semibold text-brand-primary hover:underline"
            >
              Clear filter
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse text-left font-sans text-sm">
            <caption className="caption-bottom px-3 pb-2 pt-1 text-left text-xs text-ink-muted">
              Click a row to open full page details.
            </caption>
            <thead>
              <tr className="border-b border-line bg-surface-muted/80">
                <SortableTh
                  label="Status"
                  column="statusCode"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh label="URL" column="url" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh label="Title" column="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                <SortableTh
                  label="Depth"
                  column="crawlDepth"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="ms"
                  column="responseTimeMs"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
                <SortableTh
                  label="Schema"
                  column="hasSchema"
                  sortKey={sortKey}
                  sortDir={sortDir}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {displayedPages.map((row) => {
                const rowError = isErrorStatusCode(row.statusCode)
                return (
                <tr
                  key={row.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`View details for ${row.url}`}
                  className={`border-b border-line outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
                    rowError
                      ? 'cursor-pointer bg-semantic-error-light hover:bg-red-100'
                      : 'cursor-pointer hover:bg-surface-muted/40'
                  }`}
                  onClick={() => setDetailPageId(row.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setDetailPageId(row.id)
                    }
                  }}
                >
                  <td
                    className={`px-3 py-2 font-mono text-xs ${
                      rowError ? 'font-semibold text-semantic-error' : ''
                    }`}
                  >
                    {row.statusCode ?? '—'}
                  </td>
                  <td className="max-w-[280px] truncate px-3 py-2 font-mono text-xs text-ink-primary">{row.url}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-ink-secondary">{row.title ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.crawlDepth}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.responseTimeMs ?? '—'}</td>
                  <td className="px-3 py-2 text-xs">
                    {row.hasSchema === true ? (
                      <span className="rounded-md bg-semantic-success-light px-2 py-0.5 font-semibold text-semantic-success">
                        Yes
                      </span>
                    ) : row.hasSchema === false ? (
                      <span className="text-ink-muted">No</span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
    {detailPageId ? (
      <PageDetailModal crawlId={cid} pageId={detailPageId} onClose={() => setDetailPageId(null)} />
    ) : null}
    </>
  )
}
