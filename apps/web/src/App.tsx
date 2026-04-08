import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { PrivateRoute } from '@/components/auth/PrivateRoute'
import { AppShell } from '@/components/layout/AppShell'
import { AuditProgress } from '@/pages/Audit/AuditProgress'
import { AuditSelect } from '@/pages/Audit/AuditSelect'
import { Login } from '@/pages/auth/Login'
import { Register } from '@/pages/auth/Register'
import { CrawlConfig } from '@/pages/Crawl/CrawlConfig'
import { CrawlSelect } from '@/pages/Crawl/CrawlSelect'
import { CrawlView } from '@/pages/Crawl/CrawlView'
import { Dashboard } from '@/pages/Dashboard'
import { Landing } from '@/pages/Landing'
import { ProjectDetail } from '@/pages/Projects/ProjectDetail'
import { ProjectList } from '@/pages/Projects/ProjectList'
import { ReportDetail } from '@/pages/Reports/ReportDetail'
import { ReportList } from '@/pages/Reports/ReportList'
import { Settings } from '@/pages/Settings'
import { SpeedTestPage } from '@/pages/Speed/SpeedTestPage'

function PrivateLayout({ children }: { children: ReactNode }) {
  return (
    <PrivateRoute>
      <AppShell>{children}</AppShell>
    </PrivateRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/dashboard"
        element={
          <PrivateLayout>
            <Dashboard />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects"
        element={
          <PrivateLayout>
            <ProjectList />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <PrivateLayout>
            <ProjectDetail />
          </PrivateLayout>
        }
      />
      <Route
        path="/crawl"
        element={
          <PrivateLayout>
            <CrawlSelect />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects/:projectId/crawl"
        element={
          <PrivateLayout>
            <CrawlSelect />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects/:projectId/crawl/config"
        element={
          <PrivateLayout>
            <CrawlConfig />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects/:projectId/crawl/:crawlId"
        element={
          <PrivateLayout>
            <CrawlView />
          </PrivateLayout>
        }
      />
      <Route
        path="/audit"
        element={
          <PrivateLayout>
            <AuditSelect />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects/:projectId/audit"
        element={
          <PrivateLayout>
            <AuditSelect />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects/:projectId/audit/:auditId"
        element={
          <PrivateLayout>
            <AuditProgress />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects/:projectId/reports"
        element={
          <PrivateLayout>
            <ReportList />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects/:projectId/reports/:reportId"
        element={
          <PrivateLayout>
            <ReportDetail />
          </PrivateLayout>
        }
      />
      <Route
        path="/speed"
        element={
          <PrivateLayout>
            <SpeedTestPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/projects/:projectId/speed"
        element={
          <PrivateLayout>
            <SpeedTestPage />
          </PrivateLayout>
        }
      />
      <Route
        path="/settings"
        element={
          <PrivateLayout>
            <Settings />
          </PrivateLayout>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
