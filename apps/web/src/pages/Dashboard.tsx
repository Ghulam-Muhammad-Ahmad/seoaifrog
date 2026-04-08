import { useQuery } from '@tanstack/react-query'
import { FolderKanban, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiJson } from '@/lib/api'

interface ProjectDTO {
  id: string
  name: string
  rootUrl?: string | null
  createdAt?: string
}

async function fetchProjects(): Promise<ProjectDTO[]> {
  try {
    return await apiJson<ProjectDTO[]>('/api/projects')
  } catch {
    return []
  }
}

export function Dashboard() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-primary">Dashboard</h1>
          <p className="mt-1 font-sans text-sm text-ink-secondary">
            Crawl → Audit → Report. Pick up where you left off.
          </p>
        </div>
        <Link
          to="/projects"
          className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Projects
        </Link>
      </div>

      <section className="mt-8 rounded-card border border-line bg-surface-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-primary">
          <FolderKanban className="h-5 w-5 text-brand-primary" aria-hidden />
          Recent projects
        </h2>
        {isLoading ? (
          <p className="mt-4 font-sans text-sm text-ink-muted">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="mt-4 font-sans text-sm text-ink-secondary">
            No projects yet.{' '}
            <Link to="/projects" className="font-semibold text-brand-primary hover:underline">
              Create one
            </Link>{' '}
            to run your first crawl.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-line">
            {projects.slice(0, 5).map((p) => (
              <li key={p.id} className="py-3 first:pt-0">
                <Link
                  to={`/projects/${p.id}`}
                  className="group flex items-center justify-between font-sans text-sm focus-ring rounded-md"
                >
                  <span className="font-semibold text-ink-primary group-hover:text-brand-primary">{p.name}</span>
                  {p.rootUrl ? (
                    <span className="hidden max-w-[50%] truncate font-mono text-xs text-ink-muted sm:inline">
                      {p.rootUrl}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
