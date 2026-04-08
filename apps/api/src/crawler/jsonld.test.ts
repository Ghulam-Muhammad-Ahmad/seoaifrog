import test from 'node:test'
import assert from 'node:assert/strict'
import * as cheerio from 'cheerio'
import { extractJsonLdFromHtml } from './jsonld.js'

test('extracts JSON-LD from comment-wrapped script blocks', () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          <!--{"@context":"https://schema.org","@type":"Organization","name":"Acme"}-->
        </script>
      </head>
      <body></body>
    </html>
  `
  const $ = cheerio.load(html)
  const result = extractJsonLdFromHtml($)

  assert.equal(result.hasSchema, true)
  assert.equal(result.schemaTypes, 'Organization')
  assert.ok(result.schemaJson)
  const parsed = JSON.parse(result.schemaJson ?? '[]') as Array<Record<string, unknown>>
  assert.equal(parsed[0]?.['@type'], 'Organization')
})

test('retains raw JSON-LD payload when parsing fails', () => {
  const html = `
    <html>
      <head>
        <script type="application/ld+json">
          {"@context":"https://schema.org","@type":"WebSite",}
        </script>
      </head>
      <body></body>
    </html>
  `
  const $ = cheerio.load(html)
  const result = extractJsonLdFromHtml($)

  assert.equal(result.hasSchema, true)
  assert.equal(result.schemaTypes, null)
  assert.ok(result.schemaJson)

  const parsed = JSON.parse(result.schemaJson ?? '[]') as Array<Record<string, unknown>>
  assert.equal(parsed[0]?._unparsedJsonLd === undefined, false)
})
