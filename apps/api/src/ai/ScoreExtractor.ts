export function extractScoreFromMarkdown(text: string): number | null {
  const m = text.match(/^Score:\s*(\d{1,3})\s*\/\s*100/im)
  if (!m) return null
  const n = parseInt(m[1], 10)
  if (Number.isNaN(n) || n < 0 || n > 100) return null
  return n
}
