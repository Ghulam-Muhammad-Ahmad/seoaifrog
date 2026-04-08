const DEFAULT_BASE = 'http://localhost:3001'

/** In dev, empty base uses Vite proxy (`/api`, `/ws`). Set VITE_API_URL to override. */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL
  if (raw !== undefined && raw !== '') return raw.replace(/\/$/, '')
  if (import.meta.env.DEV) return ''
  return DEFAULT_BASE
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function errorMessageFromBody(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null) {
    const o = data as Record<string, unknown>
    if (typeof o.error === 'string' && o.error) return o.error
    if (typeof o.message === 'string' && o.message) return o.message
  }
  return fallback
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl()
  const normalized = path.startsWith('/') ? path : `/${path}`
  const url = base === '' ? normalized : `${base}${normalized}`

  const headers = new Headers(init?.headers)
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  })

  return res
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(path, init)
  const text = await res.text()
  let data: unknown
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = text
  }
  if (!res.ok) {
    throw new ApiError(errorMessageFromBody(data, res.statusText || 'Request failed'), res.status, data)
  }
  return data as T
}
