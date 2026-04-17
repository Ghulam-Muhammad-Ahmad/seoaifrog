import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { useProject } from '@/contexts/ProjectContext'

const PROJECT_URL_RE = /^\/projects\/([^/]+)/

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { selectedProjectId, setSelectedProjectId, projects } = useProject()

  useEffect(() => {
    const match = PROJECT_URL_RE.exec(location.pathname)
    if (!match) return
    const urlProjectId = match[1]
    if (urlProjectId && urlProjectId !== selectedProjectId && projects.some((p) => p.id === urlProjectId)) {
      setSelectedProjectId(urlProjectId)
    }
  }, [location.pathname, projects, setSelectedProjectId])

  return (
    <div className="min-h-screen bg-surface-base">
      <Sidebar />
      <Header />
      <main className="ml-[220px] mt-[56px] min-h-[calc(100vh-56px)]">
        <div className="mx-auto max-w-shell px-6 py-6">{children}</div>
      </main>
    </div>
  )
}
