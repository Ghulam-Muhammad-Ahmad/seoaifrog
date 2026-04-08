import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const _dir = dirname(fileURLToPath(import.meta.url))
const skillsDir = join(_dir, 'skills')

const cache = new Map<string, string>()

export async function loadSkillMarkdown(skillName: string): Promise<string> {
  const hit = cache.get(skillName)
  if (hit !== undefined) return hit
  const path = join(skillsDir, `${skillName}.md`)
  const text = await readFile(path, 'utf8')
  cache.set(skillName, text)
  return text
}

export function clearSkillCache(): void {
  cache.clear()
}
