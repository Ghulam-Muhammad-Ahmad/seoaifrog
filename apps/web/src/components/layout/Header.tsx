import { LogOut, Settings, User } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="fixed left-[220px] right-0 top-0 z-40 flex h-[56px] items-center justify-between border-b border-line bg-surface-card px-4">
      <div className="flex items-center gap-3" />
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
