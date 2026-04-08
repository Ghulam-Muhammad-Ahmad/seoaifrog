import { useQuery } from '@tanstack/react-query'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { defaultCrawlConfig, type CrawlConfig } from '@seoaifrog/shared'
import { ApiError, apiJson } from '@/lib/api'
import type { ProjectDTO } from '@/pages/Projects/ProjectList'

async function fetchProject(id: string): Promise<ProjectDTO | null> {
  try {
    return await apiJson<ProjectDTO>(`/api/projects/${id}`)
  } catch {
    return null
  }
}

export function CrawlConfig() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [config, setConfig] = useState<CrawlConfig>(() => ({ ...defaultCrawlConfig }))
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [urlSeeded, setUrlSeeded] = useState(false)
  const [customStartUrl, setCustomStartUrl] = useState(false)

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: Boolean(projectId),
  })

  const projectRootUrl = project?.rootUrl?.trim() ?? ''
  const hasProjectUrl = projectRootUrl.length > 0
  const startUrlLocked = hasProjectUrl && !customStartUrl

  useEffect(() => {
    setUrlSeeded(false)
    setCustomStartUrl(false)
  }, [projectId])

  useEffect(() => {
    if (urlSeeded || projectLoading) return
    const root = project?.rootUrl?.trim()
    if (root) {
      setConfig((c) => ({ ...c, startUrl: root }))
    }
    setUrlSeeded(true)
  }, [project, projectLoading, urlSeeded])

  function toggleCustomStartUrl(enabled: boolean) {
    setCustomStartUrl(enabled)
    if (!enabled && projectRootUrl) {
      setConfig((c) => ({ ...c, startUrl: projectRootUrl }))
    }
  }

  async function startCrawl(e: FormEvent) {
    e.preventDefault()
    if (!projectId) return
    setPending(true)
    setMessage(null)
    try {
      const session = await apiJson<{ id: string }>(`/api/projects/${projectId}/crawls`, {
        method: 'POST',
        body: JSON.stringify({ config }),
      })
      navigate(`/projects/${projectId}/crawl/${session.id}`)
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Network error')
    } finally {
      setPending(false)
    }
  }

  if (!projectId) {
    return <p className="font-sans text-sm text-semantic-error">Missing project.</p>
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-primary">Crawl configuration</h1>
          <p className="mt-1 font-sans text-sm text-ink-secondary">Defaults from workspace shared types.</p>
        </div>
        <Link
          to={`/projects/${projectId}`}
          className="focus-ring font-sans text-sm font-semibold text-brand-primary hover:text-brand-primary-hover"
        >
          ← Project & crawls
        </Link>
      </div>

      <form
        onSubmit={startCrawl}
        className="mt-8 max-w-2xl space-y-4 rounded-card border border-line bg-surface-card p-6"
      >
        <div>
          <label htmlFor="startUrl" className="block font-sans text-xs font-semibold text-ink-secondary">
            Start URL
            {projectLoading ? (
              <span className="ml-2 font-normal text-ink-muted">(loading project…)</span>
            ) : null}
          </label>
          <input
            id="startUrl"
            value={config.startUrl}
            onChange={(e) => setConfig((c) => ({ ...c, startUrl: e.target.value }))}
            disabled={startUrlLocked}
            className={`focus-ring mt-1 w-full rounded-lg border border-line-strong px-3 py-2 font-mono text-sm ${
              startUrlLocked ? 'cursor-not-allowed bg-surface-muted text-ink-secondary' : ''
            }`}
            placeholder={hasProjectUrl ? projectRootUrl : 'https://'}
          />
          {hasProjectUrl ? (
            <label className="mt-2 flex cursor-pointer items-start gap-2 font-sans text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={customStartUrl}
                onChange={(e) => toggleCustomStartUrl(e.target.checked)}
              />
              <span className="text-ink-secondary">
                <span className="font-medium text-ink-primary">Use a different start URL</span>
                <span className="mt-0.5 block text-xs">
                  Filled from this project’s root URL. Enable to edit or replace it for this crawl only.
                </span>
              </span>
            </label>
          ) : project && !projectLoading ? (
            <p className="mt-2 font-sans text-xs text-ink-muted">
              This project has no root URL yet — enter a start URL above (you can set the root URL on the project page).
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-sans text-xs font-semibold text-ink-secondary">Max pages</label>
            <input
              type="number"
              value={config.maxPages}
              onChange={(e) => setConfig((c) => ({ ...c, maxPages: Number(e.target.value) }))}
              className="focus-ring mt-1 w-full rounded-lg border border-line-strong px-3 py-2 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-ink-secondary">Max depth</label>
            <input
              type="number"
              value={config.maxDepth}
              onChange={(e) => setConfig((c) => ({ ...c, maxDepth: Number(e.target.value) }))}
              className="focus-ring mt-1 w-full rounded-lg border border-line-strong px-3 py-2 font-mono text-sm"
            />
          </div>
        </div>
        <div className="space-y-3 font-sans text-sm">
          <label className="flex cursor-pointer items-start gap-2">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={config.crawlFromSitemapOnly}
              onChange={(e) =>
                setConfig((c) => ({ ...c, crawlFromSitemapOnly: e.target.checked }))
              }
            />
            <span>
              <span className="font-semibold text-ink-primary">Sitemap-only crawl</span>
              <span className="mt-0.5 block text-xs text-ink-secondary">
                Discover sitemap(s) from the site (robots.txt and common paths), collect listed URLs, then fetch only
                those pages — no crawling via in-page links.
              </span>
            </span>
          </label>
          {config.crawlFromSitemapOnly ? (
            <div className="ml-6 border-l-2 border-line pl-4">
              <label htmlFor="sitemapUrl" className="block font-sans text-xs font-semibold text-ink-secondary">
                Sitemap URL (optional)
              </label>
              <input
                id="sitemapUrl"
                value={config.sitemapUrl}
                onChange={(e) => setConfig((c) => ({ ...c, sitemapUrl: e.target.value }))}
                className="focus-ring mt-1 w-full rounded-lg border border-line-strong px-3 py-2 font-mono text-sm"
                placeholder="Leave empty to auto-discover, or paste sitemap.xml / index URL"
              />
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-6 font-sans text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.respectRobots}
              onChange={(e) => setConfig((c) => ({ ...c, respectRobots: e.target.checked }))}
            />
            Respect robots.txt
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.renderJs}
              onChange={(e) => setConfig((c) => ({ ...c, renderJs: e.target.checked }))}
            />
            Render JavaScript
          </label>
        </div>
        {message ? <p className="font-sans text-xs text-ink-secondary">{message}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="focus-ring rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
        >
          {pending ? 'Starting…' : 'Start crawl'}
        </button>
      </form>
    </div>
  )
}
