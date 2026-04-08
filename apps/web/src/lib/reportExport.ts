import { apiFetch } from '@/lib/api'

/** Download report as .md via authenticated export endpoint (sets Content-Disposition: attachment). */
export async function exportReportFile(reportId: string, fallbackTitle: string): Promise<void> {
  const res = await apiFetch(`/api/reports/${reportId}/export`)
  if (!res.ok) throw new Error('Export failed')
  const blob = await res.blob()
  const cd = res.headers.get('Content-Disposition')
  const ext = res.headers.get('Content-Type')?.includes('html') ? 'html' : 'md'
  let name = `${slugFileBase(fallbackTitle)}.${ext}`
  const m = cd?.match(/filename="([^"]+)"/) ?? cd?.match(/filename\*=UTF-8''([^;]+)/)
  if (m?.[1]) name = decodeURIComponent(m[1].replace(/"/g, ''))
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function slugFileBase(title: string): string {
  const s = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
  return s || 'report'
}

export function markdownExportFilename(title: string, reportId: string): string {
  return `${slugFileBase(title)}-${reportId.slice(0, 8)}.md`
}

/** Client-side save when markdown is already in memory (e.g. right after generate). */
export function downloadMarkdownString(filename: string, markdown: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.md') ? filename : `${filename}.md`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
