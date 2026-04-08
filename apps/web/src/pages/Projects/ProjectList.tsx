import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, FolderKanban, X } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError, apiJson } from '@/lib/api'

export interface ProjectDTO {
  id: string
  name: string
  rootUrl?: string | null
  domain?: string
  createdAt?: string
}

async function fetchProjects(): Promise<ProjectDTO[]> {
  try {
    return await apiJson<ProjectDTO[]>('/api/projects')
  } catch {
    return []
  }
}

function normalizeRootUrl(input: string): { rootUrl: string; domain: string } | null {
  let s = input.trim()
  if (!s) return null
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    const host = u.hostname
    if (!host) return null
    const rootUrl = u.pathname === '/' || u.pathname === '' ? u.origin : `${u.origin}${u.pathname}`.replace(/\/$/, '')
    return { rootUrl, domain: host }
  } catch {
    return null
  }
}

export function ProjectList() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState('')
  const [rootUrlInput, setRootUrlInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const createMutation = useMutation({
    mutationFn: async (body: { name: string; domain: string; rootUrl: string }) =>
      apiJson<ProjectDTO>('/api/projects', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      setModalOpen(false)
      setName('')
      setRootUrlInput('')
      setFormError(null)
      navigate(`/projects/${project.id}`)
    },
    onError: (e: unknown) => {
      setFormError(e instanceof ApiError ? e.message : 'Could not create project')
    },
  })

  const closeModal = useCallback(() => {
    setModalOpen(false)
    setFormError(null)
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, closeModal])

  function submit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = normalizeRootUrl(rootUrlInput)
    if (!name.trim()) {
      setFormError('Enter a project name')
      return
    }
    if (!parsed) {
      setFormError('Enter a valid site URL (e.g. https://example.com)')
      return
    }
    createMutation.mutate({
      name: name.trim(),
      domain: parsed.domain,
      rootUrl: parsed.rootUrl,
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-primary">Projects</h1>
          <p className="mt-1 font-sans text-sm text-ink-secondary">
            Each project holds crawls, audits, and exported reports.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="focus-ring rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover"
        >
          New project
        </button>
      </div>

      <div className="mt-8 rounded-card border border-line bg-surface-card">
        {isLoading ? (
          <p className="p-6 font-sans text-sm text-ink-muted">Loading projects…</p>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <FolderKanban className="h-10 w-10 text-ink-muted" aria-hidden />
            <p className="font-sans text-sm text-ink-secondary">No projects yet.</p>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="focus-ring mt-2 rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  to={`/projects/${p.id}`}
                  className="focus-ring flex items-center justify-between gap-4 px-4 py-4 transition hover:bg-surface-muted/60"
                >
                  <div className="min-w-0">
                    <p className="font-sans text-sm font-semibold text-ink-primary">{p.name}</p>
                    {p.rootUrl ? (
                      <p className="mt-0.5 truncate font-mono text-xs text-ink-muted">{p.rootUrl}</p>
                    ) : null}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-primary/40 p-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) closeModal()
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-project-title"
            className="w-full max-w-md rounded-card border border-line bg-surface-card p-6 shadow-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="new-project-title" className="font-display text-lg font-semibold text-ink-primary">
                New project
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="focus-ring rounded-lg p-1 text-ink-muted hover:bg-surface-muted hover:text-ink-primary"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-1 font-sans text-xs text-ink-secondary">
              Name your audit workspace and set the main site URL to crawl.
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="proj-name" className="block font-sans text-xs font-semibold text-ink-secondary">
                  Project name
                </label>
                <input
                  id="proj-name"
                  value={name}
                  onChange={(ev) => setName(ev.target.value)}
                  className="focus-ring mt-1 w-full rounded-lg border border-line-strong px-3 py-2 font-sans text-sm"
                  placeholder="Client site Q1"
                  autoComplete="off"
                />
              </div>
              <div>
                <label htmlFor="proj-url" className="block font-sans text-xs font-semibold text-ink-secondary">
                  Site URL
                </label>
                <input
                  id="proj-url"
                  value={rootUrlInput}
                  onChange={(ev) => setRootUrlInput(ev.target.value)}
                  className="focus-ring mt-1 w-full rounded-lg border border-line-strong px-3 py-2 font-mono text-sm"
                  placeholder="https://example.com"
                  autoComplete="url"
                />
                <p className="mt-1 font-sans text-[11px] text-ink-muted">https:// is added if you omit it.</p>
              </div>
              {formError ? <p className="font-sans text-xs text-semantic-error">{formError}</p> : null}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="focus-ring rounded-lg border border-line-strong bg-surface-card px-4 py-2 font-sans text-sm font-semibold text-ink-primary hover:bg-surface-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="focus-ring rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
