import test from 'node:test'
import assert from 'node:assert/strict'
import {
  COMPREHENSIVE_AUDIT_SKILL,
  decodeAuditSelection,
  encodeAuditSelection,
  isUrlWithinProjectRoot,
  normalizeAuditSkills,
} from './auditSelection.js'

test('decodeAuditSelection supports legacy array payload', () => {
  const out = decodeAuditSelection('["seo-technical","seo-content"]')
  assert.deepEqual(out.skills, ['seo-technical', 'seo-content'])
  assert.equal(out.targetUrl, null)
})

test('decodeAuditSelection supports object payload with targetUrl', () => {
  const out = decodeAuditSelection(
    '{"skills":["seo-technical","seo-schema"],"targetUrl":"https://example.com/docs"}',
  )
  assert.deepEqual(out.skills, ['seo-technical', 'seo-schema'])
  assert.equal(out.targetUrl, 'https://example.com/docs')
})

test('encodeAuditSelection writes canonical object payload', () => {
  const raw = encodeAuditSelection({
    skills: ['seo-technical'],
    targetUrl: 'https://example.com/a',
  })
  const out = decodeAuditSelection(raw)
  assert.deepEqual(out.skills, ['seo-technical'])
  assert.equal(out.targetUrl, 'https://example.com/a')
})

test('isUrlWithinProjectRoot accepts same-domain project URL', () => {
  assert.equal(isUrlWithinProjectRoot('https://example.com/blog/post', 'https://example.com'), true)
})

test('isUrlWithinProjectRoot rejects external domain URL', () => {
  assert.equal(isUrlWithinProjectRoot('https://evil.com/blog/post', 'https://example.com'), false)
})

test('normalizeAuditSkills makes seo-audit exclusive', () => {
  const out = normalizeAuditSkills(['seo-content', COMPREHENSIVE_AUDIT_SKILL, 'seo-technical'])
  assert.deepEqual(out, [COMPREHENSIVE_AUDIT_SKILL])
})
