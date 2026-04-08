import { useQuery } from '@tanstack/react-query'
import { FileSearch, FileText, Globe, Settings2 } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { apiJson } from '@/lib/api'
import type { ProjectDTO } from './ProjectList'

type CrawlSessionRow = { id: string; status: string; createdAt: string }

async function fetchProject(id: string): Promise<ProjectDTO | null> {
  try {
    return await apiJson<ProjectDTO>(`/api/projects/${id}`)
  } catch {
    return null
  }
}

async function fetchCrawls(projectId: string): Promise<CrawlSessionRow[]> {
  try {
    return await apiJson<CrawlSessionRow[]>(`/api/projects/${projectId}/crawls`)
  } catch {
    return []
  }
}

export function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>()
  const id = projectId ?? ''

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id),
    enabled: Boolean(id),
  })

  const { data: crawls = [] } = useQuery({
    queryKey: ['project-crawls', id],
    queryFn: () => fetchCrawls(id),
    enabled: Boolean(id),
  })

  const latestCrawlId = crawls[0]?.id

  if (!id) {
    return <p className="font-sans text-sm text-semantic-error">Missing project id.</p>
  }

  if (isLoading) {
    return <p className="font-sans text-sm text-ink-muted">Loading project…</p>
  }

  if (!project) {
    return <p className="font-sans text-sm text-ink-secondary">Project not found or unavailable.</p>
  }

  const base = `/projects/${project.id}`

  const cards = [
    {
      key: 'start-crawl',
      to: `${base}/crawl/config`,
      title: 'Start crawl',
      desc: 'Configure start URL, limits, and start a new crawl.',
      icon: Settings2,
    },
    {
      key: 'latest-crawl',
      to: latestCrawlId ? `${base}/crawl/${latestCrawlId}` : `${base}/crawl/config`,
      title: 'Latest crawl',
      desc: latestCrawlId
        ? 'Open the most recent crawl session (table + refresh).'
        : 'No crawls yet — start one from “Start crawl”.',
      icon: Globe,
    },
    {
      key: 'start-audit',
      to: `${base}/audit`,
      title: 'Start audit',
      desc: 'Run an SEO audit with this project pre-selected.',
      icon: FileSearch,
    },
    {
      key: 'reports',
      to: `${base}/reports`,
      title: 'Reports',
      desc: 'Generated exports and scores.',
      icon: FileText,
    },
  ] as const

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-ink-primary">{project.name}</h1>
      {project.rootUrl ? (
        <p className="mt-1 font-mono text-sm text-ink-secondary">{project.rootUrl}</p>
      ) : (
        <p className="mt-1 font-sans text-sm text-ink-muted">No root URL configured.</p>
      )}

      {crawls.length > 0 ? (
        <div className="mt-8 rounded-card border border-line bg-surface-card p-4">
          <h2 className="font-display text-sm font-semibold text-ink-primary">Recent crawls</h2>
          <ul className="mt-3 space-y-2 font-sans text-sm">
            {crawls.slice(0, 8).map((c) => (
              <li key={c.id}>
                <Link
                  to={`${base}/crawl/${c.id}`}
                  className="focus-ring font-mono text-xs text-brand-primary hover:text-brand-primary-hover"
                >
                  {c.status} · {new Date(c.createdAt).toLocaleString()} · {c.id.slice(0, 8)}…
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {cards.map(({ key, to, title, desc, icon: Icon }) => (
          <Link
            key={key}
            to={to}
            className="focus-ring group rounded-card border border-line bg-surface-card p-5 shadow-sm transition hover:border-brand-primary/40 hover:shadow-md"
          >
            <Icon className="h-6 w-6 text-brand-primary" aria-hidden />
            <h2 className="mt-3 font-display text-lg font-semibold text-ink-primary group-hover:text-brand-deep">
              {title}
            </h2>
            <p className="mt-1 font-sans text-sm text-ink-secondary">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
