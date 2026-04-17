import { useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Loader2, Lock, UserCircle } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ApiError, apiJson } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

const inputClass =
  'focus-ring mt-1 w-full rounded-lg border border-line-strong px-3 py-2.5 font-sans text-sm outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20'

const labelClass = 'block font-sans text-xs font-semibold text-ink-secondary'

/** Raw GET /api/account/settings — normalized below for forward/back compat */
interface AccountSettingsResponseRaw {
  user?: {
    name?: string | null
    email?: string | null
    avatar?: string | null
    openAiKeyConfigured?: boolean
    pageSpeedKeyConfigured?: boolean
  } | null
  name?: string | null
  email?: string | null
  avatar?: string | null
  avatarUrl?: string | null
  openaiKeyConfigured?: boolean
  hasOpenAiKey?: boolean
  openAiKeyConfigured?: boolean
  pageSpeedKeyConfigured?: boolean
  profile?: {
    name?: string | null
    email?: string | null
    avatarUrl?: string | null
  }
}

export interface AccountSettingsView {
  name: string
  email: string
  avatarUrl: string
  openaiKeyConfigured: boolean
  pageSpeedKeyConfigured: boolean
}

function normalizeSettings(raw: unknown): AccountSettingsView {
  const o = raw && typeof raw === 'object' ? (raw as AccountSettingsResponseRaw) : {}
  const u = o.user && typeof o.user === 'object' ? o.user : undefined
  const p = o.profile && typeof o.profile === 'object' ? o.profile : undefined

  const name = (typeof o.name === 'string' ? o.name : u?.name ?? p?.name) ?? ''
  const email = (typeof o.email === 'string' ? o.email : u?.email ?? p?.email) ?? ''
  const avatarUrl =
    (typeof o.avatarUrl === 'string'
      ? o.avatarUrl
      : typeof o.avatar === 'string'
        ? o.avatar
        : u?.avatar ?? p?.avatarUrl) ?? ''

  const openaiKeyConfigured =
    typeof o.openaiKeyConfigured === 'boolean'
      ? o.openaiKeyConfigured
      : typeof o.hasOpenAiKey === 'boolean'
        ? o.hasOpenAiKey
        : typeof u?.openAiKeyConfigured === 'boolean'
          ? u.openAiKeyConfigured
        : typeof o.openAiKeyConfigured === 'boolean'
          ? o.openAiKeyConfigured
          : false

  return {
    name,
    email,
    avatarUrl,
    openaiKeyConfigured,
    pageSpeedKeyConfigured: typeof u?.pageSpeedKeyConfigured === 'boolean' ? u.pageSpeedKeyConfigured : false,
  }
}

async function fetchAccountSettings(): Promise<AccountSettingsView> {
  const raw = await apiJson<unknown>('/api/account/settings')
  return normalizeSettings(raw)
}

interface OpenAiKeyTestResponse {
  ok?: boolean
  success?: boolean
  valid?: boolean
  message?: string
}

interface PageSpeedTestResponse {
  valid?: boolean
  message?: string
  error?: string
}

function isTruthyFlag(v: unknown): boolean {
  return v === true
}

/** 200 with no boolean flags is treated as success; explicit false on any flag fails. */
function interpretKeyTest(body: OpenAiKeyTestResponse): { ok: boolean; message?: string } {
  const msg = typeof body.message === 'string' ? body.message : undefined
  const hasFlags = 'ok' in body || 'success' in body || 'valid' in body
  if (!hasFlags) return { ok: true, message: msg }
  const ok = isTruthyFlag(body.ok) || isTruthyFlag(body.success) || isTruthyFlag(body.valid)
  return { ok, message: msg }
}

export function AccountSettings() {
  const queryClient = useQueryClient()
  const { refetch: refetchAuth } = useAuth()

  const {
    data: settings,
    isLoading: settingsLoading,
    error: settingsQueryError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['account', 'settings'],
    queryFn: fetchAccountSettings,
  })

  const loadError =
    settingsQueryError instanceof ApiError
      ? settingsQueryError.message
      : settingsQueryError
        ? 'Could not load account settings'
        : null

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  const snapshot = useMemo(() => settings ?? null, [settings])

  useEffect(() => {
    if (!snapshot) return
    setName(snapshot.name)
    setEmail(snapshot.email)
    setAvatarUrl(snapshot.avatarUrl)
  }, [snapshot])

  const openaiKeyConfigured = settings?.openaiKeyConfigured ?? false
  const pageSpeedKeyConfigured = settings?.pageSpeedKeyConfigured ?? false

  const [profilePending, setProfilePending] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordPending, setPasswordPending] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)

  const [openaiKeyInput, setOpenaiKeyInput] = useState('')
  const [keyPending, setKeyPending] = useState(false)
  const [keyDetachPending, setKeyDetachPending] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)
  const [keySuccess, setKeySuccess] = useState<string | null>(null)
  const [keyTestPending, setKeyTestPending] = useState(false)
  const [keyTestError, setKeyTestError] = useState<string | null>(null)
  const [keyTestSuccess, setKeyTestSuccess] = useState<string | null>(null)
  const [pageSpeedKeyInput, setPageSpeedKeyInput] = useState('')
  const [pageSpeedPending, setPageSpeedPending] = useState(false)
  const [pageSpeedDetachPending, setPageSpeedDetachPending] = useState(false)
  const [pageSpeedError, setPageSpeedError] = useState<string | null>(null)
  const [pageSpeedSuccess, setPageSpeedSuccess] = useState<string | null>(null)
  const [pageSpeedTestPending, setPageSpeedTestPending] = useState(false)
  const [pageSpeedTestError, setPageSpeedTestError] = useState<string | null>(null)
  const [pageSpeedTestSuccess, setPageSpeedTestSuccess] = useState<string | null>(null)

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(null)
    setProfilePending(true)
    try {
      await apiJson<unknown>('/api/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim() || null,
          email: email.trim(),
          avatar: avatarUrl.trim() || null,
        }),
      })
      setProfileSuccess('Profile updated.')
      await queryClient.invalidateQueries({ queryKey: ['account', 'settings'] })
      void refetchAuth()
    } catch (err) {
      setProfileError(err instanceof ApiError ? err.message : 'Could not save profile')
    } finally {
      setProfilePending(false)
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.')
      return
    }
    setPasswordPending(true)
    try {
      await apiJson<unknown>('/api/account/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setPasswordSuccess('Password changed.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : 'Could not change password')
    } finally {
      setPasswordPending(false)
    }
  }

  async function onSaveOpenAiKey(e: FormEvent) {
    e.preventDefault()
    setKeyError(null)
    setKeySuccess(null)
    if (!openaiKeyInput.trim()) {
      setKeyError('Enter an API key to save.')
      return
    }
    setKeyPending(true)
    try {
      await apiJson<unknown>('/api/account/openai-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey: openaiKeyInput.trim() }),
      })
      setKeySuccess('API key saved.')
      setOpenaiKeyInput('')
      await queryClient.invalidateQueries({ queryKey: ['account', 'settings'] })
      await refetchSettings()
    } catch (err) {
      setKeyError(err instanceof ApiError ? err.message : 'Could not save API key')
    } finally {
      setKeyPending(false)
    }
  }

  async function onTestOpenAiKey() {
    setKeyTestError(null)
    setKeyTestSuccess(null)
    setKeyTestPending(true)
    try {
      const body = await apiJson<OpenAiKeyTestResponse>('/api/account/openai-key/test', {
        method: 'POST',
        body: JSON.stringify({ apiKey: openaiKeyInput.trim() || undefined }),
      })
      const { ok, message: testMsg } = interpretKeyTest(body)
      if (ok) {
        setKeyTestSuccess(testMsg && testMsg.length > 0 ? testMsg : 'Key verified successfully.')
      } else {
        setKeyTestError(testMsg && testMsg.length > 0 ? testMsg : 'Verification failed.')
      }
    } catch (err) {
      setKeyTestError(err instanceof ApiError ? err.message : 'Verification request failed')
    } finally {
      setKeyTestPending(false)
    }
  }

  async function onDetachOpenAiKey() {
    setKeyError(null)
    setKeySuccess(null)
    setKeyDetachPending(true)
    try {
      await apiJson<unknown>('/api/account/openai-key', {
        method: 'DELETE',
      })
      setOpenaiKeyInput('')
      setKeySuccess('API key removed.')
      await queryClient.invalidateQueries({ queryKey: ['account', 'settings'] })
      await refetchSettings()
    } catch (err) {
      setKeyError(err instanceof ApiError ? err.message : 'Could not remove API key')
    } finally {
      setKeyDetachPending(false)
    }
  }

  async function onSavePageSpeedKey(e: FormEvent) {
    e.preventDefault()
    setPageSpeedError(null)
    setPageSpeedSuccess(null)
    if (!pageSpeedKeyInput.trim()) {
      setPageSpeedError('Enter a PageSpeed API key.')
      return
    }
    setPageSpeedPending(true)
    try {
      await apiJson('/api/account/pagespeed-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey: pageSpeedKeyInput.trim() }),
      })
      setPageSpeedKeyInput('')
      setPageSpeedSuccess('PageSpeed API key saved.')
      await queryClient.invalidateQueries({ queryKey: ['account', 'settings'] })
      await refetchSettings()
    } catch (err) {
      setPageSpeedError(err instanceof ApiError ? err.message : 'Could not save PageSpeed API key')
    } finally {
      setPageSpeedPending(false)
    }
  }

  async function onTestPageSpeedKey() {
    setPageSpeedTestError(null)
    setPageSpeedTestSuccess(null)
    setPageSpeedTestPending(true)
    try {
      const res = await apiJson<PageSpeedTestResponse>('/api/account/pagespeed-key/test', {
        method: 'POST',
        body: JSON.stringify({ apiKey: pageSpeedKeyInput.trim() || undefined }),
      })
      if (res.valid) {
        setPageSpeedTestSuccess(res.message ?? 'PageSpeed API key verified.')
      } else {
        setPageSpeedTestError(res.error ?? 'PageSpeed API key verification failed.')
      }
    } catch (err) {
      setPageSpeedTestError(err instanceof ApiError ? err.message : 'Could not test PageSpeed API key')
    } finally {
      setPageSpeedTestPending(false)
    }
  }

  async function onDetachPageSpeedKey() {
    setPageSpeedError(null)
    setPageSpeedSuccess(null)
    setPageSpeedDetachPending(true)
    try {
      await apiJson('/api/account/pagespeed-key', { method: 'DELETE' })
      setPageSpeedKeyInput('')
      setPageSpeedSuccess('PageSpeed API key removed.')
      await queryClient.invalidateQueries({ queryKey: ['account', 'settings'] })
      await refetchSettings()
    } catch (err) {
      setPageSpeedError(err instanceof ApiError ? err.message : 'Could not remove PageSpeed API key')
    } finally {
      setPageSpeedDetachPending(false)
    }
  }

  if (settingsLoading && !settings) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" aria-label="Loading settings" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-primary">Account settings</h1>
          <p className="mt-1 font-sans text-sm text-ink-secondary">Profile, password, and API keys.</p>
        </div>
      </div>

      {loadError ? (
        <p className="mt-6 rounded-lg border border-semantic-error/30 bg-semantic-error-light px-4 py-3 font-sans text-sm text-semantic-error">
          {loadError}
        </p>
      ) : null}

      <section className="mt-8 rounded-card border border-line bg-surface-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-primary">
          <UserCircle className="h-5 w-5 text-brand-primary" aria-hidden />
          Profile
        </h2>
        <p className="mt-1 font-sans text-sm text-ink-secondary">Update how you appear in the app.</p>
        <form onSubmit={onSaveProfile} className="mt-6 max-w-xl space-y-4">
          <div>
            <label htmlFor="settings-name" className={labelClass}>
              Username / name
            </label>
            <input
              id="settings-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="settings-email" className={labelClass}>
              Email
            </label>
            <input
              id="settings-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="settings-avatar" className={labelClass}>
              Avatar URL
            </label>
            <input
              id="settings-avatar"
              name="avatarUrl"
              type="url"
              autoComplete="off"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className={inputClass}
              placeholder="https://…"
            />
          </div>
          {profileError ? <p className="font-sans text-xs text-semantic-error">{profileError}</p> : null}
          {profileSuccess ? <p className="font-sans text-xs text-semantic-success">{profileSuccess}</p> : null}
          <button
            type="submit"
            disabled={profilePending}
            className="focus-ring rounded-lg bg-brand-primary px-4 py-2.5 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {profilePending ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-card border border-line bg-surface-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-primary">
          <KeyRound className="h-5 w-5 text-brand-primary" aria-hidden />
          PageSpeed API key
        </h2>
        <p className="mt-1 font-sans text-sm text-ink-secondary">
          Preferred setup: save your Google PageSpeed Insights API key for speed testing.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs font-semibold text-ink-secondary">Status:</span>
          {pageSpeedKeyConfigured ? (
            <span className="rounded-badge border border-semantic-success/40 bg-semantic-success-light px-2.5 py-1 font-sans text-xs font-semibold text-semantic-success">
              Key configured
            </span>
          ) : (
            <span className="rounded-badge border border-line bg-surface-muted px-2.5 py-1 font-sans text-xs font-semibold text-ink-secondary">
              No key on file
            </span>
          )}
        </div>
        <form onSubmit={onSavePageSpeedKey} className="mt-6 max-w-xl space-y-4">
          <div>
            <label htmlFor="settings-pagespeed-key" className={labelClass}>
              API key
            </label>
            <input
              id="settings-pagespeed-key"
              name="pagespeedApiKey"
              type="password"
              autoComplete="off"
              value={pageSpeedKeyInput}
              onChange={(e) => setPageSpeedKeyInput(e.target.value)}
              className={inputClass}
              placeholder="AIza..."
            />
          </div>
          {pageSpeedError ? <p className="font-sans text-xs text-semantic-error">{pageSpeedError}</p> : null}
          {pageSpeedSuccess ? <p className="font-sans text-xs text-semantic-success">{pageSpeedSuccess}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pageSpeedPending || pageSpeedDetachPending}
              className="focus-ring rounded-lg bg-brand-primary px-4 py-2.5 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
            >
              {pageSpeedPending ? 'Saving…' : pageSpeedKeyConfigured ? 'Update key' : 'Save key'}
            </button>
            <button
              type="button"
              disabled={pageSpeedTestPending}
              onClick={() => void onTestPageSpeedKey()}
              className="focus-ring rounded-lg border border-line-strong bg-surface-card px-4 py-2.5 font-sans text-sm font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-60"
            >
              {pageSpeedTestPending ? 'Verifying…' : 'Test key'}
            </button>
            {pageSpeedKeyConfigured ? (
              <button
                type="button"
                disabled={pageSpeedDetachPending || pageSpeedPending}
                onClick={() => void onDetachPageSpeedKey()}
                className="focus-ring rounded-lg border border-semantic-error/40 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-semantic-error hover:bg-semantic-error-light disabled:opacity-60"
              >
                {pageSpeedDetachPending ? 'Removing…' : 'Detach key'}
              </button>
            ) : null}
          </div>
        </form>
        {pageSpeedTestError ? <p className="mt-4 font-sans text-xs text-semantic-error">{pageSpeedTestError}</p> : null}
        {pageSpeedTestSuccess ? (
          <p className="mt-4 font-sans text-xs text-semantic-success">{pageSpeedTestSuccess}</p>
        ) : null}
      </section>

      <section className="mt-8 rounded-card border border-line bg-surface-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-primary">
          <Lock className="h-5 w-5 text-brand-primary" aria-hidden />
          Password
        </h2>
        <p className="mt-1 font-sans text-sm text-ink-secondary">Use a strong password you do not reuse elsewhere.</p>
        <form onSubmit={onChangePassword} className="mt-6 max-w-xl space-y-4">
          <div>
            <label htmlFor="settings-current-password" className={labelClass}>
              Current password
            </label>
            <input
              id="settings-current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label htmlFor="settings-new-password" className={labelClass}>
              New password
            </label>
            <input
              id="settings-new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              required
              minLength={8}
            />
          </div>
          <div>
            <label htmlFor="settings-confirm-password" className={labelClass}>
              Confirm new password
            </label>
            <input
              id="settings-confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              required
              minLength={8}
            />
          </div>
          {passwordError ? <p className="font-sans text-xs text-semantic-error">{passwordError}</p> : null}
          {passwordSuccess ? <p className="font-sans text-xs text-semantic-success">{passwordSuccess}</p> : null}
          <button
            type="submit"
            disabled={passwordPending}
            className="focus-ring rounded-lg bg-brand-primary px-4 py-2.5 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
          >
            {passwordPending ? 'Updating…' : 'Change password'}
          </button>
        </form>
      </section>

      <section className="mt-8 rounded-card border border-line bg-surface-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-primary">
          <KeyRound className="h-5 w-5 text-brand-primary" aria-hidden />
          OpenAI API key
        </h2>
        <p className="mt-1 font-sans text-sm text-ink-secondary">
          Stored on your account for AI features. The key is never shown after you save it.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs font-semibold text-ink-secondary">Status:</span>
          {openaiKeyConfigured ? (
            <span className="rounded-badge border border-semantic-success/40 bg-semantic-success-light px-2.5 py-1 font-sans text-xs font-semibold text-semantic-success">
              Key configured
            </span>
          ) : (
            <span className="rounded-badge border border-line bg-surface-muted px-2.5 py-1 font-sans text-xs font-semibold text-ink-secondary">
              No key on file
            </span>
          )}
        </div>
        <form onSubmit={onSaveOpenAiKey} className="mt-6 max-w-xl space-y-4">
          <div>
            <label htmlFor="settings-openai-key" className={labelClass}>
              API key
            </label>
            <input
              id="settings-openai-key"
              name="openaiApiKey"
              type="password"
              autoComplete="off"
              value={openaiKeyInput}
              onChange={(e) => setOpenaiKeyInput(e.target.value)}
              className={inputClass}
              placeholder={openaiKeyConfigured ? 'Enter a new key to replace the stored key' : 'sk-…'}
            />
          </div>
          {keyError ? <p className="font-sans text-xs text-semantic-error">{keyError}</p> : null}
          {keySuccess ? <p className="font-sans text-xs text-semantic-success">{keySuccess}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={keyPending || keyDetachPending}
              className="focus-ring rounded-lg bg-brand-primary px-4 py-2.5 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
            >
              {keyPending ? 'Saving…' : openaiKeyConfigured ? 'Update key' : 'Save key'}
            </button>
            <button
              type="button"
              disabled={keyTestPending}
              onClick={() => void onTestOpenAiKey()}
              className="focus-ring rounded-lg border border-line-strong bg-surface-card px-4 py-2.5 font-sans text-sm font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-60"
            >
              {keyTestPending ? 'Verifying…' : 'Test / verify key'}
            </button>
            {openaiKeyConfigured ? (
              <button
                type="button"
                disabled={keyDetachPending || keyPending}
                onClick={() => void onDetachOpenAiKey()}
                className="focus-ring rounded-lg border border-semantic-error/40 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-semantic-error hover:bg-semantic-error-light disabled:opacity-60"
              >
                {keyDetachPending ? 'Removing…' : 'Detach key'}
              </button>
            ) : null}
          </div>
        </form>
        {keyTestError ? (
          <p className="mt-4 font-sans text-xs text-semantic-error">{keyTestError}</p>
        ) : null}
        {keyTestSuccess ? (
          <p className="mt-4 font-sans text-xs text-semantic-success">{keyTestSuccess}</p>
        ) : null}
      </section>

    </div>
  )
}
