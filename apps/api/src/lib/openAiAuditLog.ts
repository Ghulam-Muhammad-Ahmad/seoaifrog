import { mkdir, appendFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

function envFlagTrue(v: string | undefined): boolean {
  if (!v) return false
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase())
}

function envFlagFalse(v: string | undefined): boolean {
  if (!v) return false
  return ['0', 'false', 'no', 'off'].includes(v.trim().toLowerCase())
}

/** Logs when NODE_ENV is production, unless OPENAI_AUDIT_LOG disables it. Outside production, set OPENAI_AUDIT_LOG=1 to test. */
function shouldWriteAuditLog(): boolean {
  if (envFlagFalse(process.env.OPENAI_AUDIT_LOG)) return false
  if (process.env.NODE_ENV === 'production') return true
  return envFlagTrue(process.env.OPENAI_AUDIT_LOG)
}

function resolveLogDir(): string {
  const override = process.env.OPENAI_AUDIT_LOG_DIR?.trim()
  if (override) return override
  const here = dirname(fileURLToPath(import.meta.url))
  // Compiled: apps/api/dist/lib → api root is ../..
  // Source (tsx): apps/api/src/lib → api root is ../..
  const apiRoot = join(here, '..', '..')
  return join(apiRoot, 'logs')
}

let loggedDestinationOnce = false

export type OpenAiAuditLogEntry = {
  ts: string
  skillName: string
  model: string
  systemPrompt: string
  userPayload: string
  rawResponse: string
  score: number | null
  tokensUsed: number
  durationMs: number
  promptTokens?: number
  completionTokens?: number
  /** inline string vs uploaded JSON file (user_data) referenced in chat */
  payloadDelivery?: 'inline' | 'openai_file'
  openaiInputFileId?: string | null
}

/**
 * Appends one JSON line per OpenAI skill call when logging is enabled (production by default, or OPENAI_AUDIT_LOG=1).
 * Default file: apps/api/logs/openai-audit-YYYY-MM-DD.ndjson (override with OPENAI_AUDIT_LOG_DIR).
 */
export async function appendOpenAiAuditLog(
  entry: Omit<OpenAiAuditLogEntry, 'ts'> & { ts?: string },
): Promise<void> {
  if (!shouldWriteAuditLog()) return

  const ts = entry.ts ?? new Date().toISOString()
  const line = JSON.stringify({ ...entry, ts }) + '\n'

  try {
    const dir = resolveLogDir()
    await mkdir(dir, { recursive: true })
    const dateStr = ts.slice(0, 10)
    const filePath = join(dir, `openai-audit-${dateStr}.ndjson`)
    await appendFile(filePath, line, 'utf8')
    if (!loggedDestinationOnce) {
      loggedDestinationOnce = true
      console.info(`[openai-audit-log] appending OpenAI skill audit lines to: ${filePath}`)
    }
  } catch (e) {
    console.error('[openai-audit-log] write failed:', e)
  }
}
