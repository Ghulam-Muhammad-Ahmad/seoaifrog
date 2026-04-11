export type AuditSelection = {
  skills: string[]
  targetUrl: string | null
}

export const COMPREHENSIVE_AUDIT_SKILL = 'seo-audit'

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
        skills: normalizeAuditSkills(
          parsed.filter((x): x is string => typeof x === 'string' && x.trim().length > 0),
        ),
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
      return { skills: normalizeAuditSkills(skills), targetUrl }
    }
  } catch {
    // Fall through to defaults.
  }
  return { skills: [], targetUrl: null }
}

export function encodeAuditSelection(selection: AuditSelection): string {
  return JSON.stringify({
    skills: normalizeAuditSkills(selection.skills),
    targetUrl: selection.targetUrl,
  })
}

export function normalizeAuditSkills(skills: string[]): string[] {
  const clean = [...new Set(skills.map((s) => s.trim()).filter((s) => s.length > 0))]
  if (clean.includes(COMPREHENSIVE_AUDIT_SKILL)) return [COMPREHENSIVE_AUDIT_SKILL]
  return clean
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
