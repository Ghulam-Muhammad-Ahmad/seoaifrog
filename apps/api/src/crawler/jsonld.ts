import type * as cheerio from 'cheerio'

const MAX_SCHEMA_JSON_CHARS = 250_000

function parseJsonLdBlock(raw: string): unknown | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const candidates = new Set<string>([trimmed])

  // Common CMS wrappers around JSON-LD blocks.
  const unwrappedComment = trimmed.replace(/^<!--\s*/, '').replace(/\s*-->$/, '').trim()
  if (unwrappedComment) candidates.add(unwrappedComment)

  const unwrappedCdata = unwrappedComment
    .replace(/^<!\[CDATA\[\s*/, '')
    .replace(/\s*\]\]>$/, '')
    .trim()
  if (unwrappedCdata) candidates.add(unwrappedCdata)

  // Some templates append a semicolon to an otherwise valid JSON object/array.
  const noTrailingSemicolon = unwrappedCdata.replace(/;\s*$/, '').trim()
  if (noTrailingSemicolon) candidates.add(noTrailingSemicolon)

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown
    } catch {
      // Try next normalization candidate.
    }
  }
  return null
}

function collectSchemaTypes(node: unknown, out: Set<string>): void {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const x of node) collectSchemaTypes(x, out)
    return
  }
  const o = node as Record<string, unknown>
  const t = o['@type']
  if (typeof t === 'string') out.add(t)
  else if (Array.isArray(t)) {
    for (const x of t) {
      if (typeof x === 'string') out.add(x)
    }
  }
  if (Array.isArray(o['@graph'])) collectSchemaTypes(o['@graph'], out)
}

export type JsonLdExtractResult = {
  hasSchema: boolean
  schemaTypes: string | null
  schemaJson: string | null
}

/**
 * Parse all `application/ld+json` script tags; collect @type values and store raw JSON blocks.
 */
export function extractJsonLdFromHtml($: cheerio.CheerioAPI): JsonLdExtractResult {
  const parsedBlocks: unknown[] = []
  const rawBlocks: string[] = []
  const types = new Set<string>()
  let scriptCount = 0

  $('script').each((_, el) => {
    const type = ($(el).attr('type') || '').trim().toLowerCase()
    if (!type.includes('application/ld+json')) return
    const raw = $(el).html()?.trim()
    if (!raw) return
    scriptCount++
    rawBlocks.push(raw)

    const parsed = parseJsonLdBlock(raw)
    if (parsed !== null) {
      parsedBlocks.push(parsed)
      collectSchemaTypes(parsed, types)
    }
  })

  const hasSchema = scriptCount > 0
  const schemaTypes = types.size > 0 ? [...types].sort().join(', ') : null

  let schemaJson: string | null = null
  if (parsedBlocks.length > 0) {
    schemaJson = JSON.stringify(parsedBlocks)
  } else if (rawBlocks.length > 0) {
    schemaJson = JSON.stringify(rawBlocks.map((raw) => ({ _unparsedJsonLd: raw })))
  }

  if (schemaJson) {
    if (schemaJson.length > MAX_SCHEMA_JSON_CHARS) {
      schemaJson = `${schemaJson.slice(0, MAX_SCHEMA_JSON_CHARS)}\n/* truncated */`
    }
  }

  return { hasSchema, schemaTypes, schemaJson }
}
