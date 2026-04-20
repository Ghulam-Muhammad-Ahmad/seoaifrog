import { FileSearch, FileText, FolderKanban, Gauge, SearchCode, LayoutDashboard, Settings } from 'lucide-react'
import { NavLink, useLocation } from 'react-router-dom'
import { useProject } from '@/contexts/ProjectContext'
import { FrogMark } from '@/components/FrogMark'

export function Sidebar() {
  const location = useLocation()
  const { selectedProjectId } = useProject()

  const crawlTo = selectedProjectId ? `/projects/${selectedProjectId}/crawl` : '/crawl'
  const auditTo = selectedProjectId ? `/projects/${selectedProjectId}/audit` : '/audit'
  const reportsTo = selectedProjectId ? `/projects/${selectedProjectId}/reports` : '/projects'
  const speedTo = selectedProjectId ? `/projects/${selectedProjectId}/speed` : '/speed'

  const crawlNavActive =
    location.pathname === '/crawl' || /\/projects\/[^/]+\/crawl(\/|$)/.test(location.pathname)
  const auditNavActive =
    location.pathname === '/audit' || /\/projects\/[^/]+\/audit(\/|$)/.test(location.pathname)
  const reportsNavActive = /\/projects\/[^/]+\/reports(\/|$)/.test(location.pathname)
  const speedNavActive =
    location.pathname === '/speed' || /\/projects\/[^/]+\/speed(\/|$)/.test(location.pathname)
  const projectsNavActive =
    location.pathname === '/projects' || /^\/projects\/[^/]+$/.test(location.pathname)

  return (
    <aside className="fixed left-0 top-0 z-50 flex h-full w-sidebar flex-col border-r border-line bg-surface-card">
      <div className="flex h-header shrink-0 items-center border-b border-line px-4">
        <NavLink
          to="/dashboard"
          className="focus-ring flex items-center gap-2 rounded-lg"
        >
          <FrogMark size={26} radius={7} />
          <span className="font-display text-[13.5px] font-bold tracking-tight text-brand-deep">
            SEO <span className="text-brand-primary">AI</span> Frog
          </span>
        </NavLink>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3" aria-label="Main">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            [
              'focus-ring flex items-center gap-2 rounded-lg px-3 py-2.5 font-sans text-sm font-semibold transition-colors',
              isActive
                ? 'bg-brand-primary-light text-brand-deep'
                : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary',
            ].join(' ')
          }
        >
          <LayoutDashboard className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Dashboard
        </NavLink>

        <NavLink
          to="/projects"
          className={[
            'focus-ring flex items-center gap-2 rounded-lg px-3 py-2.5 font-sans text-sm font-semibold transition-colors',
            projectsNavActive
              ? 'bg-brand-primary-light text-brand-deep'
              : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary',
          ].join(' ')}
        >
          <FolderKanban className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          All projects
        </NavLink>

        <NavLink
          to={crawlTo}
          className={[
            'focus-ring flex items-center gap-2 rounded-lg px-3 py-2.5 font-sans text-sm font-semibold transition-colors',
            crawlNavActive
              ? 'bg-brand-primary-light text-brand-deep'
              : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary',
          ].join(' ')}
        >
          <SearchCode className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Crawling
        </NavLink>

        <NavLink
          to={speedTo}
          className={[
            'focus-ring flex items-center gap-2 rounded-lg px-3 py-2.5 font-sans text-sm font-semibold transition-colors',
            speedNavActive
              ? 'bg-brand-primary-light text-brand-deep'
              : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary',
          ].join(' ')}
        >
          <Gauge className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Speed testing
        </NavLink>

        <NavLink
          to={auditTo}
          className={[
            'focus-ring flex items-center gap-2 rounded-lg px-3 py-2.5 font-sans text-sm font-semibold transition-colors',
            auditNavActive
              ? 'bg-brand-primary-light text-brand-deep'
              : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary',
          ].join(' ')}
        >
          <FileSearch className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          SEO audit
        </NavLink>

        <NavLink
          to={reportsTo}
          className={[
            'focus-ring flex items-center gap-2 rounded-lg px-3 py-2.5 font-sans text-sm font-semibold transition-colors',
            reportsNavActive
              ? 'bg-brand-primary-light text-brand-deep'
              : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary',
          ].join(' ')}
        >
          <FileText className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Reports
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            [
              'focus-ring flex items-center gap-2 rounded-lg px-3 py-2.5 font-sans text-sm font-semibold transition-colors',
              isActive
                ? 'bg-brand-primary-light text-brand-deep'
                : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary',
            ].join(' ')
          }
        >
          <Settings className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Account settings
        </NavLink>
      </nav>
    </aside>
  )
}
