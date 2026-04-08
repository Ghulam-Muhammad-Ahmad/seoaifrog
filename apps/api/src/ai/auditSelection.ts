export type AuditSelection = {
  skills: string[]
  targetUrl: string | null
}

type StoredSelection =
  | string[]
  | {
      skills?: unknown
      targetUrl?: unknown
    }

export function decodeAuditSelection(raw: string): AuditSelection {
  try {
    const parsed = JSON.parse(raw) as StoredSelection
    if (Array.isArray(parsed)) {
      return {
        skills: parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0),
        targetUrl: null,
      }
    }
    if (parsed && typeof parsed === 'object') {
      const skills = Array.isArray(parsed.skills)
        ? parsed.skills.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        : []
      const targetUrl =
        typeof parsed.targetUrl === 'string' && parsed.targetUrl.trim().length > 0
          ? parsed.targetUrl.trim()
          : null
      return { skills, targetUrl }
    }
  } catch {
    // Fall through to defaults.
  }
  return { skills: [], targetUrl: null }
}

export function encodeAuditSelection(selection: AuditSelection): string {
  return JSON.stringify({
    skills: selection.skills,
    targetUrl: selection.targetUrl,
  })
}

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

export function isUrlWithinProjectRoot(targetUrl: string, projectRootUrl: string): boolean {
  try {
    const target = new URL(targetUrl)
    const root = new URL(projectRootUrl)
    const targetHost = normalizeHost(target.hostname)
    const rootHost = normalizeHost(root.hostname)
    return targetHost === rootHost
  } catch {
    return false
  }
}
