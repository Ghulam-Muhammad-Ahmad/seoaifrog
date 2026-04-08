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
    googlePsiConfigured?: boolean
    googlePsiTokenExpiresAt?: string | null
  } | null
  name?: string | null
  email?: string | null
  avatar?: string | null
  avatarUrl?: string | null
  openaiKeyConfigured?: boolean
  hasOpenAiKey?: boolean
  openAiKeyConfigured?: boolean
  googlePsiConfigured?: boolean
  googlePsiTokenExpiresAt?: string | null
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
  googlePsiConfigured: boolean
  googlePsiTokenExpiresAt: string | null
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
    googlePsiConfigured: typeof u?.googlePsiConfigured === 'boolean' ? u.googlePsiConfigured : false,
    googlePsiTokenExpiresAt:
      typeof u?.googlePsiTokenExpiresAt === 'string' || u?.googlePsiTokenExpiresAt === null
        ? (u.googlePsiTokenExpiresAt ?? null)
        : null,
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

interface GooglePsiTestResponse {
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
  const googlePsiConfigured = settings?.googlePsiConfigured ?? false
  const googlePsiTokenExpiresAt = settings?.googlePsiTokenExpiresAt ?? null

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
  const [googleTokenInput, setGoogleTokenInput] = useState('')
  const [googleExpiresInHours, setGoogleExpiresInHours] = useState('1')
  const [googlePending, setGooglePending] = useState(false)
  const [googleDetachPending, setGoogleDetachPending] = useState(false)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [googleSuccess, setGoogleSuccess] = useState<string | null>(null)
  const [googleTestPending, setGoogleTestPending] = useState(false)
  const [googleTestError, setGoogleTestError] = useState<string | null>(null)
  const [googleTestSuccess, setGoogleTestSuccess] = useState<string | null>(null)

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

  async function onSaveGooglePsiToken(e: FormEvent) {
    e.preventDefault()
    setGoogleError(null)
    setGoogleSuccess(null)
    if (!googleTokenInput.trim()) {
      setGoogleError('Enter a Google OAuth access token.')
      return
    }
    const parsedHours = Number.parseInt(googleExpiresInHours, 10)
    if (!Number.isFinite(parsedHours) || parsedHours <= 0) {
      setGoogleError('Enter a valid token expiry in hours.')
      return
    }
    setGooglePending(true)
    try {
      await apiJson('/api/account/google-psi-oauth', {
        method: 'POST',
        body: JSON.stringify({
          accessToken: googleTokenInput.trim(),
          expiresInSec: parsedHours * 3600,
        }),
      })
      setGoogleTokenInput('')
      setGoogleSuccess('Google OAuth token saved.')
      await queryClient.invalidateQueries({ queryKey: ['account', 'settings'] })
      await refetchSettings()
    } catch (err) {
      setGoogleError(err instanceof ApiError ? err.message : 'Could not save Google OAuth token')
    } finally {
      setGooglePending(false)
    }
  }

  async function onTestGooglePsiToken() {
    setGoogleTestError(null)
    setGoogleTestSuccess(null)
    setGoogleTestPending(true)
    try {
      const res = await apiJson<GooglePsiTestResponse>('/api/account/google-psi-oauth/test', {
        method: 'POST',
        body: '{}',
      })
      if (res.valid) {
        setGoogleTestSuccess(res.message ?? 'Google OAuth token works for PageSpeed Insights.')
      } else {
        setGoogleTestError(res.error ?? 'Google OAuth verification failed.')
      }
    } catch (err) {
      setGoogleTestError(err instanceof ApiError ? err.message : 'Could not test Google OAuth token')
    } finally {
      setGoogleTestPending(false)
    }
  }

  async function onDetachGooglePsiToken() {
    setGoogleError(null)
    setGoogleSuccess(null)
    setGoogleDetachPending(true)
    try {
      await apiJson('/api/account/google-psi-oauth', { method: 'DELETE' })
      setGoogleTokenInput('')
      setGoogleSuccess('Google OAuth token removed.')
      await queryClient.invalidateQueries({ queryKey: ['account', 'settings'] })
      await refetchSettings()
    } catch (err) {
      setGoogleError(err instanceof ApiError ? err.message : 'Could not remove Google OAuth token')
    } finally {
      setGoogleDetachPending(false)
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
          <p className="mt-1 font-sans text-sm text-ink-secondary">Profile, password, and your OpenAI API key.</p>
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

      <section className="mt-8 rounded-card border border-line bg-surface-card p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-ink-primary">
          <KeyRound className="h-5 w-5 text-brand-primary" aria-hidden />
          Google OAuth for PageSpeed
        </h2>
        <p className="mt-1 font-sans text-sm text-ink-secondary">
          Save your Google OAuth access token for PageSpeed Insights API access (no PSI API key required).
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="font-sans text-xs font-semibold text-ink-secondary">Status:</span>
          {googlePsiConfigured ? (
            <span className="rounded-badge border border-semantic-success/40 bg-semantic-success-light px-2.5 py-1 font-sans text-xs font-semibold text-semantic-success">
              Connected
            </span>
          ) : (
            <span className="rounded-badge border border-line bg-surface-muted px-2.5 py-1 font-sans text-xs font-semibold text-ink-secondary">
              Not connected
            </span>
          )}
          {googlePsiTokenExpiresAt ? (
            <span className="font-sans text-xs text-ink-secondary">
              Expires {new Date(googlePsiTokenExpiresAt).toLocaleString()}
            </span>
          ) : null}
        </div>
        <form onSubmit={onSaveGooglePsiToken} className="mt-6 max-w-xl space-y-4">
          <div>
            <label htmlFor="settings-google-token" className={labelClass}>
              OAuth access token
            </label>
            <input
              id="settings-google-token"
              name="googleOAuthToken"
              type="password"
              autoComplete="off"
              value={googleTokenInput}
              onChange={(e) => setGoogleTokenInput(e.target.value)}
              className={inputClass}
              placeholder="ya29..."
            />
          </div>
          <div>
            <label htmlFor="settings-google-expires" className={labelClass}>
              Token expiry (hours)
            </label>
            <input
              id="settings-google-expires"
              name="googleTokenExpiryHours"
              type="number"
              min={1}
              max={24}
              value={googleExpiresInHours}
              onChange={(e) => setGoogleExpiresInHours(e.target.value)}
              className={inputClass}
            />
          </div>
          {googleError ? <p className="font-sans text-xs text-semantic-error">{googleError}</p> : null}
          {googleSuccess ? <p className="font-sans text-xs text-semantic-success">{googleSuccess}</p> : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={googlePending || googleDetachPending}
              className="focus-ring rounded-lg bg-brand-primary px-4 py-2.5 font-sans text-sm font-semibold text-white hover:bg-brand-primary-hover disabled:opacity-60"
            >
              {googlePending ? 'Saving…' : googlePsiConfigured ? 'Update token' : 'Save token'}
            </button>
            <button
              type="button"
              disabled={googleTestPending}
              onClick={() => void onTestGooglePsiToken()}
              className="focus-ring rounded-lg border border-line-strong bg-surface-card px-4 py-2.5 font-sans text-sm font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-60"
            >
              {googleTestPending ? 'Verifying…' : 'Test token'}
            </button>
            {googlePsiConfigured ? (
              <button
                type="button"
                disabled={googleDetachPending || googlePending}
                onClick={() => void onDetachGooglePsiToken()}
                className="focus-ring rounded-lg border border-semantic-error/40 bg-white px-4 py-2.5 font-sans text-sm font-semibold text-semantic-error hover:bg-semantic-error-light disabled:opacity-60"
              >
                {googleDetachPending ? 'Removing…' : 'Disconnect'}
              </button>
            ) : null}
          </div>
        </form>
        {googleTestError ? <p className="mt-4 font-sans text-xs text-semantic-error">{googleTestError}</p> : null}
        {googleTestSuccess ? (
          <p className="mt-4 font-sans text-xs text-semantic-success">{googleTestSuccess}</p>
        ) : null}
      </section>
    </div>
  )
}
