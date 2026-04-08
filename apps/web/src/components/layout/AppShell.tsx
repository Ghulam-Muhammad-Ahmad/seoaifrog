import type { ReactNode } from 'react'
import { Header } from './Header'
import { Sidebar } from './Sidebar'

export function AppShell({ children }: { children: ReactNode }) {
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
