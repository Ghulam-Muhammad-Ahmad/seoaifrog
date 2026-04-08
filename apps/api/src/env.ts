import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

/** Directory containing this file: apps/api/src */
const srcDir = dirname(fileURLToPath(import.meta.url))
/** apps/api */
const apiRoot = join(srcDir, '..')
/** Monorepo root (seoaifrog) */
const repoRoot = join(apiRoot, '..', '..')

const repoEnv = join(repoRoot, '.env')
const apiEnv = join(apiRoot, '.env')

// Repo-wide defaults first, then apps/api/.env wins (secrets + DB next to the API)
if (existsSync(repoEnv)) {
  dotenv.config({ path: repoEnv })
}
if (existsSync(apiEnv)) {
  dotenv.config({ path: apiEnv, override: true })
} else if (!existsSync(repoEnv)) {
  console.error(`
[seoaifrog] No .env file found. Create one with DATABASE_URL and REDIS_URL.

  Option A (recommended): copy and edit apps/api/.env
    copy apps\\api\\.env.example apps\\api\\.env

  Option B: use a single file at the repo root
    copy .env.example .env

Tried paths:
  - ${apiEnv}
  - ${repoEnv}
`)
}

const db = process.env.DATABASE_URL?.trim()
if (!db) {
  console.error(`[seoaifrog] DATABASE_URL is missing or empty after loading .env.
Set it in apps/api/.env or in the repo root .env, for example:

  DATABASE_URL=mongodb://localhost:27017/seoaifrog

Then run: npm run db:migrate
`)
  process.exit(1)
}
process.env.DATABASE_URL = db

const accountEnc = process.env.ACCOUNT_ENCRYPTION_KEY?.trim()
if (accountEnc) {
  if (!/^[0-9a-fA-F]{64}$/.test(accountEnc)) {
    console.error(`[seoaifrog] ACCOUNT_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).
Generate one with:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
`)
    process.exit(1)
  }
  process.env.ACCOUNT_ENCRYPTION_KEY = accountEnc.toLowerCase()
} else {
  console.warn(
    '[seoaifrog] ACCOUNT_ENCRYPTION_KEY is not set. Saving a per-user OpenAI key or testing a saved key will fail until you set a 64-char hex secret.',
  )
}

if (!process.env.REDIS_URL?.trim()) {
  process.env.REDIS_URL = 'redis://127.0.0.1:6379'
}
