import { useEffect } from 'react'
import { ChevronDown, LogOut, Plus, Settings, User } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useProject } from '@/contexts/ProjectContext'

function buildProjectRoute(pathname: string, projectId: string): string | null {
  if (/^\/projects\/[^/]+\/crawl(?:\/|$)/.test(pathname) || pathname === '/crawl') {
    return `/projects/${projectId}/crawl`
  }
  if (/^\/projects\/[^/]+\/audit(?:\/|$)/.test(pathname) || pathname === '/audit') {
    return `/projects/${projectId}/audit`
  }
  if (/^\/projects\/[^/]+\/reports(?:\/|$)/.test(pathname)) {
    return `/projects/${projectId}/reports`
  }
  if (/^\/projects\/[^/]+\/speed(?:\/|$)/.test(pathname) || pathname === '/speed') {
    return `/projects/${projectId}/speed`
  }
  return null
}

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { projects, isLoading, selectedProjectId, selectedProject, setSelectedProjectId } = useProject()

  useEffect(() => {
    if (!selectedProjectId) return
    // Don't redirect when already on a URL scoped to the selected project
    const match = /^\/projects\/([^/]+)/.exec(location.pathname)
    const urlProjectId = match?.[1]
    if (urlProjectId === selectedProjectId) return

    const nextPath = buildProjectRoute(location.pathname, selectedProjectId)
    if (nextPath && nextPath !== location.pathname) {
      navigate(nextPath, { replace: true })
    }
  }, [location.pathname, navigate, selectedProjectId])

  function handleProjectChange(id: string) {
    if (!id || id === selectedProjectId) return
    setSelectedProjectId(id)
  }

  return (
    <header className="fixed left-[220px] right-0 top-0 z-40 flex h-[56px] items-center justify-between border-b border-line bg-surface-card px-4">
      <div className="flex items-center gap-3">
        <div className="relative">
          <select
            value={selectedProjectId ?? ''}
            onChange={(e) => handleProjectChange(e.target.value)}
            disabled={isLoading || (!isLoading && projects.length === 0)}
            className="focus-ring h-9 w-56 appearance-none truncate rounded-lg border border-line bg-surface-muted/40 pl-3 pr-8 font-sans text-sm font-semibold text-ink-primary transition-colors hover:border-line-strong disabled:opacity-60"
          >
            {isLoading ? (
              <option value="">Loading…</option>
            ) : projects.length === 0 ? (
              <option value="">No projects</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))
            )}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" aria-hidden />
        </div>
        {selectedProject?.rootUrl ? (
          <span className="hidden truncate font-mono text-xs text-ink-muted lg:block">
            {selectedProject.rootUrl}
          </span>
        ) : null}
        <Link
          to="/projects"
          className="focus-ring inline-flex items-center gap-1 rounded-lg border border-dashed border-line px-2 py-1.5 font-sans text-xs font-semibold text-ink-secondary hover:border-line-strong hover:bg-surface-muted"
          title="Manage projects"
        >
          <Plus className="h-3 w-3" aria-hidden />
          <span className="hidden sm:inline">New</span>
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <span
          className="rounded-badge border border-brand-primary/30 bg-brand-primary-light px-2.5 py-1 font-sans text-xs font-semibold text-brand-deep"
          title="Subscription plan"
        >
          {(user?.plan ?? 'FREE').toUpperCase()}
        </span>
        <Link
          to="/settings"
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-sans text-xs font-semibold text-ink-secondary hover:bg-surface-muted"
          title="Account settings"
        >
          <Settings className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">Settings</span>
        </Link>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-ink-secondary">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt=""
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="h-4 w-4" aria-hidden />
            )}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="font-sans text-xs font-semibold text-ink-primary">
              {user?.name || user?.email || 'Account'}
            </span>
            {user?.email ? (
              <span className="font-sans text-[11px] text-ink-muted">{user.email}</span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            void logout().then(() => navigate('/login'))
          }}
          className="focus-ring inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 font-sans text-xs font-semibold text-ink-secondary hover:bg-surface-muted"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden />
          Sign out
        </button>
      </div>
    </header>
  )
}
