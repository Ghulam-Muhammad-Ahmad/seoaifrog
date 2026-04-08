/** ~500–800 tokens; overlap preserves boundary context */
const CHUNK_CHARS = 2800
const OVERLAP = 250

export function chunkPageText(title: string | null, body: string | null): string[] {
  const header = title?.trim() ? `Title: ${title.trim()}\n\n` : ''
  const text = (body ?? '').trim()
  const full = (header + text).trim()
  if (!full) return []
  if (full.length <= CHUNK_CHARS) return [full]
  const chunks: string[] = []
  for (let i = 0; i < full.length; i += CHUNK_CHARS - OVERLAP) {
    chunks.push(full.slice(i, i + CHUNK_CHARS))
    if (i + CHUNK_CHARS >= full.length) break
  }
  return chunks
}
