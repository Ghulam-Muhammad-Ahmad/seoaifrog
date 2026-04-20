import test from 'node:test'
import assert from 'node:assert/strict'
import { getSessionCookieOptions } from './auth.js'

test('getSessionCookieOptions enables secure cookies in production', () => {
  const options = getSessionCookieOptions('production')

  assert.equal(options.httpOnly, true)
  assert.equal(options.sameSite, 'lax')
  assert.equal(options.secure, true)
})

test('getSessionCookieOptions keeps secure cookies off in development', () => {
  const options = getSessionCookieOptions('development')

  assert.equal(options.secure, false)
})
