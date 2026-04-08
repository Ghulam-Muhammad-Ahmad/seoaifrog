import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 16
const KEY_LEN = 32

type EncPayloadV1 = {
  v: 1
  iv: string
  data: string
  tag: string
}

function parseMasterKeyHex(hex: string): Buffer {
  const key = Buffer.from(hex, 'hex')
  if (key.length !== KEY_LEN) {
    throw new Error('ACCOUNT_ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters)')
  }
  return key
}

export function encryptUserSecret(plaintext: string, masterKeyHex: string): string {
  const key = parseMasterKeyHex(masterKeyHex)
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  const payload: EncPayloadV1 = {
    v: 1,
    iv: iv.toString('base64url'),
    data: enc.toString('base64url'),
    tag: tag.toString('base64url'),
  }
  return JSON.stringify(payload)
}

export function decryptUserSecret(payloadJson: string, masterKeyHex: string): string {
  const key = parseMasterKeyHex(masterKeyHex)
  let parsed: EncPayloadV1
  try {
    parsed = JSON.parse(payloadJson) as EncPayloadV1
  } catch {
    throw new Error('Invalid encrypted payload')
  }
  if (parsed.v !== 1 || !parsed.iv || !parsed.data || !parsed.tag) {
    throw new Error('Unsupported encrypted payload format')
  }
  const decipher = createDecipheriv(ALGO, key, Buffer.from(parsed.iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'))
  const dec = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, 'base64url')),
    decipher.final(),
  ])
  return dec.toString('utf8')
}
