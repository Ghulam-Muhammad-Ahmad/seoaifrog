import test from 'node:test'
import assert from 'node:assert/strict'
import { buildReportMarkdown, buildSpeedTestReportTitle } from './reportBuilder.js'

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

test('buildSpeedTestReportTitle includes device strategy in the report name', () => {
  assert.equal(
    buildSpeedTestReportTitle('example.com', ['mobile'], '17/04/2026'),
    'Speed Report - Mobile - example.com - 17/04/2026',
  )
  assert.equal(
    buildSpeedTestReportTitle('example.com', ['desktop'], '17/04/2026'),
    'Speed Report - Desktop - example.com - 17/04/2026',
  )
  assert.equal(
    buildSpeedTestReportTitle('example.com', ['mobile', 'desktop'], '17/04/2026'),
    'Speed Report - Mixed - example.com - 17/04/2026',
  )
})
