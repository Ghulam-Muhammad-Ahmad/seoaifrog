import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReportMarkdown } from './reportBuilder.js'

test('buildReportMarkdown escapes title heading and sorts skill sections', () => {
  const markdown = buildReportMarkdown('SEO # Audit', 'example.com', 84, [
    {
      skillName: 'seo-zeta',
      status: 'completed',
      score: 82,
      rawResponse: 'Z section',
    },
    {
      skillName: 'seo-alpha',
      status: 'completed',
      score: 91,
      rawResponse: 'A section',
    },
  ])

  assert.match(markdown, /^# SEO \\# Audit/m)
  assert.ok(markdown.indexOf('## seo-alpha') < markdown.indexOf('## seo-zeta'))
  assert.match(markdown, /\*\*Overall score:\*\* 84/)
})
