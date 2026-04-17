import { useQuery } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { apiJson } from '@/lib/api'

const STORAGE_KEY = 'seoaifrog:selectedProjectId'

export interface ProjectRow {
  id: string
  name: string
  rootUrl?: string | null
}

async function fetchProjects(): Promise<ProjectRow[]> {
  try {
    return await apiJson<ProjectRow[]>('/api/projects')
  } catch {
    return []
  }
}

interface ProjectContextValue {
  projects: ProjectRow[]
  isLoading: boolean
  selectedProjectId: string | null
  selectedProject: ProjectRow | null
  setSelectedProjectId: (id: string | null) => void
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

function readStoredId(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null
  } catch {
    return null
  }
}

function writeStoredId(id: string | null) {
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id)
    else localStorage.removeItem(STORAGE_KEY)
  } catch { /* ignore */ }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const [selectedId, setSelectedId] = useState<string | null>(readStoredId)

  useEffect(() => {
    if (isLoading || projects.length === 0) return
    if (selectedId && projects.some((p) => p.id === selectedId)) return
    setSelectedId(projects[0].id)
    writeStoredId(projects[0].id)
  }, [projects, isLoading, selectedId])

  const setSelectedProjectId = useCallback((id: string | null) => {
    setSelectedId((current) => (current === id ? current : id))
    writeStoredId(id)
  }, [])

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  )

  const value = useMemo<ProjectContextValue>(
    () => ({
      projects,
      isLoading,
      selectedProjectId: selectedId,
      selectedProject,
      setSelectedProjectId,
    }),
    [projects, isLoading, selectedId, selectedProject, setSelectedProjectId],
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error('useProject must be used within ProjectProvider')
  return ctx
}
