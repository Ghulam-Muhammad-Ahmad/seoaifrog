import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { apiFetch } from '@/lib/api'

export function Register() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name: name || undefined }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(typeof j.message === 'string' ? j.message : 'Registration failed')
        return
      }
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Network error')
    } finally {
      setPending(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" aria-label="Loading" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base px-4">
      <div className="w-full max-w-md rounded-card border border-line bg-surface-card p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold text-ink-primary">Create account</h1>
        <p className="mt-1 font-sans text-sm text-ink-secondary">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-primary hover:text-brand-primary-hover">
            Sign in
          </Link>
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="name" className="block font-sans text-xs font-semibold text-ink-secondary">
              Name <span className="font-normal text-ink-muted">(optional)</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="focus-ring mt-1 w-full rounded-lg border border-line-strong px-3 py-2.5 font-sans text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
            />
          </div>
          <div>
            <label htmlFor="email" className="block font-sans text-xs font-semibold text-ink-secondary">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="focus-ring mt-1 w-full rounded-lg border border-line-strong px-3 py-2.5 font-sans text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block font-sans text-xs font-semibold text-ink-secondary">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="focus-ring mt-1 w-full rounded-lg border border-line-strong px-3 py-2.5 font-sans text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20"
              required
              minLength={8}
            />
          </div>
          {error ? <p className="font-sans text-xs text-semantic-error">{error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="focus-ring w-full rounded-lg bg-brand-primary py-2.5 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {pending ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-6 text-center font-sans text-xs text-ink-muted">
          <Link to="/" className="text-ink-secondary hover:text-ink-primary">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
