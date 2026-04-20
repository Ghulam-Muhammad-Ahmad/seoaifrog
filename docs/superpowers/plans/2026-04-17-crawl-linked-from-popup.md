# Crawl Linked-From Popup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show which crawled pages link to the currently selected page inside the crawl detail popup so broken pages such as `404`s can be traced back to their source links.

**Architecture:** Reuse the outgoing links already stored in `linksJson` for each crawled page. The crawl page-detail API will derive inbound sources for the selected page by scanning other pages in the same crawl, then the web popup will render those sources in a new “Linked from” section.

**Tech Stack:** Fastify, Prisma, shared TypeScript DTOs, React, node:test

---

### Task 1: Add inbound-link derivation coverage

**Files:**
- Create: `apps/api/src/routes/crawlLinkOrigins.test.ts`
- Create: `apps/api/src/routes/crawlLinkOrigins.ts`

- [ ] **Step 1: Write the failing test**

```ts
test('findLinkedFromSources returns source pages whose extracted links match the target URL', () => {
  const linkedFrom = findLinkedFromSources(
    'https://example.com/missing',
    [
      {
        url: 'https://example.com/a',
        linksJson: JSON.stringify([{ href: 'https://example.com/missing', text: 'Broken link', rel: '', isInternal: true }]),
      },
    ],
  )

  assert.deepEqual(linkedFrom, [
    { url: 'https://example.com/a', text: 'Broken link', rel: '' },
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node ..\..\node_modules\typescript\bin\tsc --noEmit`
Expected: FAIL because `findLinkedFromSources` does not exist yet

- [ ] **Step 3: Write minimal implementation**

```ts
export function findLinkedFromSources(targetUrl: string, pages: SourcePageLike[]): CrawledPageOriginDTO[] {
  // parse each page's linksJson, keep entries whose href matches targetUrl,
  // dedupe by source page URL + link text + rel
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node ..\..\node_modules\typescript\bin\tsc --noEmit`
Expected: PASS for the new helper and test types

### Task 2: Extend crawl detail API

**Files:**
- Modify: `apps/api/src/routes/crawls.ts`
- Modify: `packages/shared/src/types/crawl.ts`

- [ ] **Step 1: Extend the shared DTO**

```ts
export interface CrawledPageOriginDTO {
  url: string
  text: string
  rel: string
}
```

- [ ] **Step 2: Add `linkedFrom` to `CrawledPageDetailDTO`**

```ts
linkedFrom: CrawledPageOriginDTO[]
```

- [ ] **Step 3: Use the helper inside `/crawls/:id/pages/:pageId`**

```ts
const sourcePages = await fastify.prisma.crawledPage.findMany({
  where: { crawlSessionId: id, id: { not: pageId }, linksJson: { not: null } },
  select: { url: true, linksJson: true },
})
const linkedFrom = findLinkedFromSources(p.url, sourcePages)
```

- [ ] **Step 4: Return `linkedFrom` in the detail response**

```ts
const detail: CrawledPageDetailDTO = {
  ...,
  linkedFrom,
}
```

### Task 3: Render linked sources in the popup

**Files:**
- Modify: `apps/web/src/pages/Crawl/CrawlView.tsx`

- [ ] **Step 1: Add a “Linked from” section below extracted links**

```tsx
{data.linkedFrom.length > 0 ? (
  <div>
    <h3 className="font-semibold text-ink-primary">Linked from</h3>
    ...
  </div>
) : (
  <div className="rounded-lg ...">No stored source links point to this page.</div>
)}
```

- [ ] **Step 2: Show the source page URL and optional anchor text**

```tsx
{data.linkedFrom.map((origin, i) => (
  <li key={`${origin.url}-${origin.text}-${i}`}>
    {origin.url}
    {origin.text ? <span>“{origin.text}”</span> : null}
  </li>
))}
```

### Task 4: Verify end-to-end behavior

**Files:**
- Verify only

- [ ] **Step 1: Run API typecheck**

Run: `node ..\..\node_modules\typescript\bin\tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Build API test artifacts**

Run: `node ..\..\node_modules\typescript\bin\tsc`
Expected: PASS

- [ ] **Step 3: Run focused regression tests**

Run: `@'
import './dist/routes/crawlLinkOrigins.test.js'
'@ | node -`
Expected: PASS
