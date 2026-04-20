import test from 'node:test'
import assert from 'node:assert/strict'
import { findLinkedFromSources } from './crawlLinkOrigins.js'

test('findLinkedFromSources returns source pages whose extracted links match the target URL', () => {
  const linkedFrom = findLinkedFromSources('https://example.com/missing', [
    {
      url: 'https://example.com/a',
      linksJson: JSON.stringify([
        { href: 'https://example.com/missing', text: 'Broken link', rel: '', isInternal: true },
        { href: 'https://example.com/ok', text: 'Other link', rel: '', isInternal: true },
      ]),
    },
    {
      url: 'https://example.com/b',
      linksJson: JSON.stringify([
        { href: 'https://example.com/missing', text: 'Broken link', rel: 'nofollow', isInternal: true },
      ]),
    },
  ])

  assert.deepEqual(linkedFrom, [
    { url: 'https://example.com/a', text: 'Broken link', rel: '' },
    { url: 'https://example.com/b', text: 'Broken link', rel: 'nofollow' },
  ])
})

test('findLinkedFromSources ignores invalid link payloads and deduplicates repeated origins', () => {
  const linkedFrom = findLinkedFromSources('https://example.com/missing', [
    {
      url: 'https://example.com/a',
      linksJson: 'not-json',
    },
    {
      url: 'https://example.com/b',
      linksJson: JSON.stringify([
        { href: 'https://example.com/missing', text: 'Broken link', rel: '', isInternal: true },
        { href: 'https://example.com/missing', text: 'Broken link', rel: '', isInternal: true },
      ]),
    },
  ])

  assert.deepEqual(linkedFrom, [
    { url: 'https://example.com/b', text: 'Broken link', rel: '' },
  ])
})
