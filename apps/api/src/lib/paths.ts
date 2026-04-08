import { isAbsolute, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

export { apiRoot }

export function resolveStoragePath(): string {
  const p = process.env.STORAGE_PATH ?? 'storage'
  return isAbsolute(p) ? p : join(apiRoot, p)
}
