# SEO AI Frog — Technical Specification

**Version:** 1.0
**Date:** 2026-04-04
**Status:** Approved for Development

---

## 1. System Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                               CLIENT LAYER                                │
│                                                                          │
│   React 18 + Vite + TypeScript                                          │
│   ┌────────────────┐  ┌──────────────────┐  ┌─────────────────────┐   │
│   │   AG Grid      │  │  TanStack Query  │  │     Zustand         │   │
│   │  (data grid)   │  │ (server state)   │  │  (client state)     │   │
│   └────────┬───────┘  └────────┬─────────┘  └──────────┬──────────┘   │
│            │ WebSocket (crawl events)        REST API    │              │
└────────────┼─────────────────────────────────────────────┼─────────────┘
             │                                             │
             │ WSS /ws/crawls/:id            HTTPS /api/* │
             │                                             │
┌────────────▼─────────────────────────────────────────────▼─────────────┐
│                            API SERVER (Fastify v4)                       │
│                                                                          │
│   Routes: auth | projects | crawls | audits | reports | export          │
│   Plugins: @fastify/websocket | prisma | better-auth | ioredis          │
│                                                                          │
│   ┌────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │
│   │  CrawlService  │  │  AuditService   │  │   ReportService     │   │
│   └───────┬────────┘  └───────┬─────────┘  └──────────┬──────────┘   │
│           │ enqueue            │ enqueue               │ enqueue       │
└───────────┼────────────────────┼───────────────────────┼──────────────┘
            │                    │                       │
┌───────────▼──────────┐ ┌──────▼──────────┐ ┌─────────▼────────────┐
│    CRAWL WORKER      │ │  AUDIT WORKER   │ │    REPORT WORKER     │
│    (BullMQ)          │ │  (BullMQ)       │ │    (BullMQ)          │
│                      │ │                 │ │                      │
│  CrawlEngine         │ │ AuditOrchest.   │ │  ReportBuilder       │
│  HttpFetcher         │ │ OpenAIClient    │ │  HTML Renderer       │
│  PlaywrightFetcher   │ │ SkillLoader     │ │  Playwright PDF      │
│  7× Extractors       │ │ PayloadBuilder  │ │                      │
│  IssueDetector       │ │                 │ │                      │
└──────────┬───────────┘ └──────┬──────────┘ └──────────┬───────────┘
           │                    │                        │
┌──────────▼────────────────────▼────────────────────────▼───────────┐
│                          DATA LAYER                                  │
│                                                                      │
│  ┌─────────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ Prisma ORM           │  │  Redis           │  │  Filesystem   │ │
│  │ MongoDB              │  │  BullMQ queues   │  │  /storage/    │ │
│  │ (Atlas or self-host) │  │  Job state       │  │  reports/     │ │
│  └─────────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| Frontend framework | React | 18.3 | Hooks, concurrent rendering, massive ecosystem |
| Frontend build | Vite | 5.x | 10× faster HMR than CRA; native ESM |
| UI components | shadcn/ui | latest | Accessible, composable, not opinionated |
| Styling | Tailwind CSS | 3.x | Utility-first, excellent DX |
| Data grid | AG Grid Community | 32.x | Virtual rows, 100k+ rows free, server-side model |
| Charts | Recharts | 2.x | Lightweight SVG, composable |
| Server state | TanStack Query | 5.x | Background refetch, cache invalidation, pagination |
| Client state | Zustand | 4.x | Minimal boilerplate, no providers |
| Backend | Fastify | 4.x | 30-40% faster than Express, TypeScript-first, JSON Schema validation |
| ORM | Prisma | 5.x | MongoDB provider; `prisma db push` for schema sync |
| Job queue | BullMQ | 5.x | Redis-backed, persists across restarts, supports pause/resume/retry |
| Auth | Better Auth | latest | Fastify plugin, email + OAuth, httpOnly cookies |
| HTTP crawling | Got.js | 14.x | Cookie jar, streaming, retry, brotli, redirects |
| HTML parsing | Cheerio | 1.0 | Fast jQuery-like server-side DOM parsing |
| JS rendering | Playwright | 1.49 | Chromium, Core Web Vitals measurement, network interception |
| AI SDK | openai | latest | Official OpenAI SDK (`OpenAI` client), Chat Completions / Responses API |
| Rate limiting | Bottleneck | 2.x | Per-key OpenAI API rate limiting |
| Monorepo | Turborepo | 2.x | Parallel builds, remote caching |
| Process manager | PM2 | 5.x | Production process management |

---

## 3. Complete Project Structure

```
D:/seoaifrog/
├── apps/
│   │
│   ├── web/                                    # React + Vite Frontend
│   │   ├── public/
│   │   │   └── favicon.svg
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── ui/                         # shadcn/ui primitives
│   │   │   │   │   ├── button.tsx
│   │   │   │   │   ├── card.tsx
│   │   │   │   │   ├── badge.tsx
│   │   │   │   │   ├── dialog.tsx
│   │   │   │   │   ├── input.tsx
│   │   │   │   │   ├── label.tsx
│   │   │   │   │   ├── select.tsx
│   │   │   │   │   ├── switch.tsx
│   │   │   │   │   ├── tabs.tsx
│   │   │   │   │   ├── toast.tsx
│   │   │   │   │   └── tooltip.tsx
│   │   │   │   │
│   │   │   │   ├── layout/
│   │   │   │   │   ├── AppShell.tsx            # sidebar + header wrapper
│   │   │   │   │   ├── Sidebar.tsx             # navigation links
│   │   │   │   │   └── Header.tsx              # breadcrumbs + user menu
│   │   │   │   │
│   │   │   │   ├── crawler/
│   │   │   │   │   ├── CrawlerGrid.tsx         # AG Grid main (Screaming Frog equivalent)
│   │   │   │   │   ├── CrawlerToolbar.tsx      # status, counts, filters, export
│   │   │   │   │   ├── CrawlerTabs.tsx         # All | HTML | Images | Issues | Redirects
│   │   │   │   │   ├── CrawlerProgress.tsx     # live progress bar + ETA
│   │   │   │   │   ├── CrawlerSidebar.tsx      # page detail panel (on row click)
│   │   │   │   │   └── ColumnConfig.ts         # all AG Grid column definitions
│   │   │   │   │
│   │   │   │   ├── audit/
│   │   │   │   │   ├── SkillSelector.tsx       # 13 skill toggle cards with presets
│   │   │   │   │   └── AuditProgressPanel.tsx  # per-skill progress bars via WebSocket
│   │   │   │   │
│   │   │   │   └── reports/
│   │   │   │       ├── ReportViewer.tsx        # renders report HTML in iframe
│   │   │   │       ├── ScoreGauge.tsx          # SVG circular gauge 0-100
│   │   │   │       ├── IssueList.tsx           # prioritized issue cards
│   │   │   │       └── SkillCard.tsx           # per-skill score summary
│   │   │   │
│   │   │   ├── pages/
│   │   │   │   ├── Landing.tsx                 # marketing landing page
│   │   │   │   ├── Auth/
│   │   │   │   │   ├── Login.tsx
│   │   │   │   │   └── Register.tsx
│   │   │   │   ├── Dashboard.tsx               # project cards + recent activity
│   │   │   │   ├── Projects/
│   │   │   │   │   ├── ProjectList.tsx
│   │   │   │   │   └── ProjectDetail.tsx       # crawl + audit history for one project
│   │   │   │   ├── Crawl/
│   │   │   │   │   ├── CrawlConfig.tsx         # settings form before crawl starts
│   │   │   │   │   ├── CrawlView.tsx           # live grid + toolbar + sidebar
│   │   │   │   │   └── CrawlHistory.tsx        # past crawl sessions for a project
│   │   │   │   ├── Audit/
│   │   │   │   │   ├── AuditSelect.tsx         # skill selection + start
│   │   │   │   │   └── AuditProgress.tsx       # live skill progress
│   │   │   │   └── Reports/
│   │   │   │       ├── ReportList.tsx
│   │   │   │       └── ReportDetail.tsx        # full report viewer + download
│   │   │   │
│   │   │   ├── stores/
│   │   │   │   ├── authStore.ts                # current user, login/logout
│   │   │   │   ├── crawlStore.ts               # active crawl state, row buffer
│   │   │   │   └── projectStore.ts             # selected project context
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useCrawlWebSocket.ts        # connects WS, buffers rows, updates AG Grid
│   │   │   │   ├── useAuditProgress.ts         # skill-by-skill progress via WS
│   │   │   │   └── useReport.ts                # fetch + cache report data
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── api.ts                      # typed fetch wrapper (all API calls)
│   │   │   │   ├── queryClient.ts              # TanStack Query client config
│   │   │   │   └── utils.ts                    # formatters, helpers
│   │   │   │
│   │   │   ├── App.tsx                         # router setup
│   │   │   └── main.tsx
│   │   │
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api/                                    # Fastify Backend
│       ├── src/
│       │   ├── server.ts                       # Fastify bootstrap + plugin registration
│       │   │
│       │   ├── routes/
│       │   │   ├── auth.ts                     # POST /register /login /logout, GET /me
│       │   │   ├── projects.ts                 # CRUD /api/projects/:id
│       │   │   ├── crawls.ts                   # start/status/pages/issues/cancel
│       │   │   ├── audits.ts                   # start/status/skill-results
│       │   │   ├── reports.ts                  # list/download/generate-pdf/share
│       │   │   └── export.ts                   # CSV/JSON crawl data export
│       │   │
│       │   ├── plugins/
│       │   │   ├── prisma.ts                   # Prisma client as Fastify decorator
│       │   │   ├── auth.ts                     # Better Auth session validation
│       │   │   ├── websocket.ts                # @fastify/websocket setup
│       │   │   └── redis.ts                    # ioredis connection as decorator
│       │   │
│       │   ├── crawler/
│       │   │   ├── CrawlEngine.ts              # BFS queue, concurrency, event emitter
│       │   │   ├── HttpFetcher.ts              # Got.js: headers, cookies, TTFB timing
│       │   │   ├── PlaywrightFetcher.ts        # Chromium: CWV, JS rendering
│       │   │   ├── RobotsChecker.ts            # robots-parser + caching
│       │   │   ├── SitemapParser.ts            # XML sitemap + sitemap index support
│       │   │   ├── IssueDetector.ts            # 50+ rule engine → PageIssue records
│       │   │   └── extractors/
│       │   │       ├── MetaExtractor.ts        # title, meta, canonical, OG, robots
│       │   │       ├── HeadingExtractor.ts     # H1-H6 structure, flags
│       │   │       ├── LinkExtractor.ts        # internal/external links, rel, anchor text
│       │   │       ├── ImageExtractor.ts       # alt, dimensions, format, loading, CLS
│       │   │       ├── SchemaExtractor.ts      # JSON-LD, Microdata, RDFa parsing
│       │   │       ├── ContentExtractor.ts     # word count, readability, text, hash
│       │   │       └── PerformanceExtractor.ts # TTFB, response time, compression headers
│       │   │
│       │   ├── ai/
│       │   │   ├── OpenAIClient.ts             # openai package + Bottleneck rate limiter
│       │   │   ├── SkillLoader.ts              # reads .md files from skills/, caches in Map
│       │   │   ├── AuditOrchestrator.ts        # parallel skill groups, progress events
│       │   │   ├── PayloadBuilder.ts           # per-skill data extraction from DB
│       │   │   ├── ScoreExtractor.ts           # parse 0-100 score from model response
│       │   │   ├── ReportBuilder.ts            # compile ReportDocument + HTML + PDF
│       │   │   └── skills/                     # SEO skill prompt .md files
│       │   │       ├── seo-audit.md
│       │   │       ├── seo-technical.md
│       │   │       ├── seo-content.md
│       │   │       ├── seo-page.md
│       │   │       ├── seo-schema.md
│       │   │       ├── seo-sitemap.md
│       │   │       ├── seo-images.md
│       │   │       ├── seo-geo.md
│       │   │       ├── seo-plan.md
│       │   │       ├── seo-programmatic.md
│       │   │       ├── seo-competitor-pages.md
│       │   │       └── seo-hreflang.md
│       │   │
│       │   ├── jobs/
│       │   │   ├── crawlWorker.ts              # BullMQ worker: runs CrawlEngine
│       │   │   ├── auditWorker.ts              # BullMQ worker: runs AuditOrchestrator
│       │   │   └── reportWorker.ts             # BullMQ worker: runs ReportBuilder
│       │   │
│       │   └── services/
│       │       ├── CrawlService.ts             # crawl business logic + DB operations
│       │       ├── AuditService.ts             # audit lifecycle management
│       │       └── ReportService.ts            # report generation + file management
│       │
│       ├── prisma/
│       │   └── schema.prisma                 # MongoDB (db push, not SQL migrate)
│       ├── storage/
│       │   ├── reports/                        # .html and .pdf report files
│       │   └── crawl-data/                     # raw crawl JSON snapshots (optional)
│       ├── templates/
│       │   └── report.hbs                      # Handlebars HTML report template
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   └── shared/                                 # shared TypeScript types
│       ├── src/
│       │   ├── types/
│       │   │   ├── crawl.ts                    # CrawlConfig, CrawledPageDTO, IssueDTO
│       │   │   ├── audit.ts                    # AuditConfig, SkillResultDTO, AuditStatus
│       │   │   └── report.ts                   # ReportDocument, ReportSection, ScoreBreakdown
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── docs/
│   ├── PRD.md                                  # Product Requirements Document
│   ├── SPEC.md                                 # Technical Specification (this file)
│   ├── DESIGN-SYSTEM.md                        # Design system specification
│   └── API.md                                  # API reference
│
├── .github/
│   └── workflows/
│       └── ci.yml                              # lint + typecheck + test
│
├── package.json                                # workspace root (npm workspaces)
├── turbo.json                                  # Turborepo pipeline
├── docker-compose.yml                          # Redis + MongoDB (dev)
├── docker-compose.prod.yml                     # production multi-service setup
├── .env.example
└── README.md
```

---

## 4. Database Schema

**Primary store:** MongoDB, accessed with **Prisma ORM**. Prisma does not apply SQL migrations to MongoDB; sync the schema with `npx prisma db push` (this repo's `npm run db:migrate` runs `prisma db push`).

**Identifiers:** Each document uses `_id` as `ObjectId`, modeled as `String @id @default(auto()) @map("_id") @db.ObjectId`. Foreign-key scalars use `@db.ObjectId`.

**Collections:** `User`, `Session`, `ApiKey`, `Project`, `CrawlSession`, `CrawledPage`, `PageIssue`, `Audit`, `SkillResult`, `Report`, `UsageRecord` — same logical fields and enums as before (large blobs remain JSON strings).

**Canonical schema:** `apps/api/prisma/schema.prisma`.

```prisma
datasource db {
  provider = "mongodb"
  url      = env("DATABASE_URL")
}
```

---

## 5. Crawler Engine — Detailed Design

### CrawlEngine.ts

```typescript
interface CrawlConfig {
  startUrl:         string
  maxPages:         number       // default 500
  maxDepth:         number       // default 10
  concurrency:      number       // default 5 parallel workers
  crawlDelay:       number       // ms between requests, default 100
  userAgent:        string       // default "SEOAiFrog/1.0"
  respectRobots:    boolean      // default true
  renderJs:         boolean      // use Playwright, default false
  jsWaitMs:         number       // Playwright wait, default 2000
  followRedirects:  boolean      // default true
  includeNoindex:   boolean      // crawl but flag, default true
  urlFilters: {
    includePatterns: string[]    // regex patterns; empty = include all
    excludePatterns: string[]    // regex patterns; empty = exclude none
  }
  maxFileSize:      number       // skip pages > N bytes, default 5MB
}

// Event emitter interface
interface CrawlEvents {
  'page':     (page: CrawledPageDTO) => void   // emitted per crawled page
  'progress': (stats: CrawlProgress) => void   // emitted every 2 seconds
  'error':    (err: Error, url: string) => void
  'complete': (stats: CrawlStats) => void
}
```

### BFS Queue Algorithm

```
queue = Set { startUrl }
visited = Set {}
workers = [] (size: config.concurrency)

async function worker():
  while queue not empty:
    url = queue.dequeue()
    if url in visited: continue
    visited.add(url)

    if visited.size >= config.maxPages: break
    if !robotsChecker.isAllowed(url): continue

    try:
      response = await fetcher.fetch(url)
      data = await Promise.all(extractors.map(e => e.extract(response)))
      issues = issueDetector.detect(data)

      page = await prisma.crawledPage.create(merge(data))
      emit('page', toDTO(page))

      for link in data.links.internal:
        if link.url not in visited and depth(link) <= config.maxDepth:
          queue.enqueue(link.url)

    catch error:
      emit('error', error, url)
      savePage({ url, statusCode: error.code ?? 0 })
```

### HttpFetcher — Key Implementation Details

- **Got.js configuration:** `cookieJar`, `followRedirects: true`, `maxRedirects: 10`, `decompress: true`
- **Redirect chain capture:** hook on `beforeRedirect` event, collect each hop
- **TTFB measurement:** `got.stream()` with `response` event timer
- **Per-domain rate limiting:** Bottleneck instance per hostname (min 100ms by default)
- **Retry:** 2 retries max, exponential backoff (500ms, 1000ms), only on network errors (not 4xx/5xx)
- **Timeout:** 30 seconds per request
- **User-Agent:** configurable, default includes version number for transparency

### PlaywrightFetcher — Key Implementation Details

- **Browser lifecycle:** single shared Chromium instance per crawl session
- **Context pool:** max 3 concurrent browser contexts (isolated cookies/storage per context)
- **Network interception:** block `image`, `font`, `stylesheet` resource types for speed
- **CWV measurement:** inject PerformanceObserver before page load:
  ```javascript
  // Injected via page.addInitScript()
  window.__cwv = {}
  new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'largest-contentful-paint')
        window.__cwv.lcp = entry.startTime
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] })
  ```
- **Wait strategy:** `networkidle` with 2000ms timeout fallback
- **JS detection heuristic:** compare `response.body` length vs `page.content()` length — if rendered is 2× larger, flag as JS-heavy

### IssueDetector — Rule Set (50+ rules)

**CRITICAL (block indexing or cause penalties):**
- `NOINDEX_TAG` — page has meta robots noindex but should be indexed
- `CANONICAL_MISMATCH` — canonical points to different URL
- `BROKEN_CANONICAL` — canonical URL returns non-200
- `DUPLICATE_TITLE` — same title as another page
- `DUPLICATE_META_DESC` — same meta description as another page
- `MISSING_TITLE` — no title tag
- `SERVER_ERROR` — 5xx status code
- `REDIRECT_CHAIN_TOO_LONG` — 3+ redirect hops
- `REDIRECT_LOOP` — circular redirect detected

**WARNING (significantly impacts rankings):**
- `MISSING_H1` — no H1 heading
- `MULTIPLE_H1` — more than one H1
- `TITLE_TOO_SHORT` — title < 30 characters
- `TITLE_TOO_LONG` — title > 60 characters
- `META_DESC_MISSING` — no meta description
- `META_DESC_TOO_SHORT` — meta description < 70 characters
- `META_DESC_TOO_LONG` — meta description > 160 characters
- `THIN_CONTENT` — fewer than 300 words
- `MISSING_SCHEMA` — page has no structured data (for key page types)
- `IMAGE_MISSING_ALT` — image without alt attribute
- `IMAGE_MISSING_DIMENSIONS` — no width/height (CLS risk)
- `BROKEN_INTERNAL_LINK` — internal link returns 4xx
- `ORPHAN_PAGE` — page has no inbound internal links
- `HREFLANG_MISSING_RETURN` — hreflang tag without matching return tag
- `SLOW_TTFB` — TTFB > 600ms
- `LARGE_HTML` — HTML size > 500KB
- `DUPLICATE_CONTENT` — content hash matches another page

**INFO (optimization opportunities):**
- `MISSING_OG_IMAGE` — no og:image for social sharing
- `IMAGE_NOT_LAZY_LOADED` — images without loading="lazy"
- `NON_OPTIMAL_IMAGE_FORMAT` — using JPG/PNG instead of WebP/AVIF
- `MISSING_CANONICAL` — no canonical tag present
- `EXTERNAL_LINKS_NOFOLLOW_ALL` — all external links are nofollowed
- `LOW_WORD_COUNT` — 300-500 words (could be improved)
- `READABILITY_LOW` — Flesch-Kincaid score < 30 (complex text)
- `MISSING_META_DESCRIPTION` — informational notice only

---

## 6. AI Integration — Detailed Design

### Skill Execution Groups

```typescript
const SKILL_GROUPS = [
  // Group 1: run in parallel (no dependencies)
  ['seo-technical', 'seo-content', 'seo-images', 'seo-schema', 'seo-sitemap', 'seo-hreflang'],
  // Group 2: run after Group 1 completes
  ['seo-geo', 'seo-page', 'seo-programmatic'],
  // Group 3: synthesis skills (run last, need all data)
  ['seo-audit', 'seo-plan'],
]
```

### OpenAI API Call Pattern

Use the official `openai` package. Prefer **Chat Completions** for broad SDK compatibility; optionally migrate to the **Responses API** when a single model endpoint is required for your deployment.

```typescript
// OpenAIClient.ts
async completeWithSkill(
  skillName: string,
  payload: SkillPayload,
): Promise<SkillResponse> {
  const systemPrompt = await skillLoader.load(skillName)  // reads .md file
  const userContent = payloadBuilder.format(skillName, payload)

  const completion = await this.limiter.schedule(() =>
    this.openai.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? 'gpt-4o',
      max_tokens: 8192,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }, // structured crawl data JSON or markdown
      ],
    }),
  )

  const rawResponse = completion.choices[0]?.message?.content ?? ''
  const score = scoreExtractor.extract(rawResponse)

  const usage = completion.usage
  const tokensUsed = (usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0)

  return { skillName, rawResponse, score, tokensUsed }
}
```

**Model selection:** Set `OPENAI_MODEL` per environment (e.g. `gpt-4o`, `gpt-4.1`, or your org’s approved audit model). Use a model with sufficient context for large crawl summaries; trim payloads in `PayloadBuilder` to control cost.

### Per-Skill Data Payloads

Each skill receives only the crawl data relevant to its analysis (minimize tokens):

| Skill | Data Sent |
|-------|-----------|
| seo-technical | Status code distribution, redirect chains, robots.txt content, canonical issues, CWV percentiles, JS errors |
| seo-content | 20 lowest word-count pages (URL + wordCount + readability), title/desc length histogram, duplicate content pairs |
| seo-images | All images missing alt text (URL + page), oversized images (>200KB), format breakdown, missing dimensions count |
| seo-schema | All JSON-LD objects found (URL + schemaTypes + raw JSON), total pages without schema |
| seo-sitemap | Raw sitemap XML, crawled URLs not in sitemap (list), sitemap URLs returning non-200 |
| seo-hreflang | All hreflang tag sets (URL + [{lang, href}]), missing return tag analysis, incorrect language codes |
| seo-geo | Top 50 pages by word count (URL + excerpt), site-wide passage density stats |
| seo-page | Full data for top 10 pages (all extracted fields) |
| seo-audit | Aggregated stats from all Group 1 skill scores + top 20 issues |
| seo-plan | Domain, industry (detected), overall scores, top issues, crawl stats |

### Rate Limiting Configuration

```typescript
// Bottleneck config for OpenAI API
const limiter = new Bottleneck({
  maxConcurrent: 5,          // max 5 simultaneous OpenAI requests
  minTime: 200,              // min 200ms between requests
  retryOnFail: true,
  retryDelay: (count) => count * 1000,  // 1s, 2s, 3s
  maxRetries: 3,
})
```

---

## 7. Report Generation — Detailed Design

### Score Weighting

```
Overall Score = weighted average of:
  Technical SEO    × 0.25   (seo-technical score)
  Content Quality  × 0.25   (seo-content score)
  On-Page SEO      × 0.20   (seo-page score)
  Schema Markup    × 0.10   (seo-schema score)
  Performance      × 0.10   (seo-technical CWV sub-score, or 0 if no Playwright)
  Images           × 0.05   (seo-images score)
  AI/GEO           × 0.05   (seo-geo score)
```

### ReportDocument Interface

```typescript
interface ReportDocument {
  meta: {
    domain:       string
    rootUrl:      string
    auditId:      string
    generatedAt:  string   // ISO date
    crawlStats: {
      totalPages:    number
      crawlDuration: number  // seconds
      errorCount:    number
      avgResponseMs: number
    }
  }
  overallScore:      number       // 0-100
  executiveSummary:  string       // AI-generated 3-paragraph markdown
  criticalIssues:    Issue[]      // top issues across all categories
  sections:          ReportSection[]  // one per skill
  recommendations:   Recommendation[]  // prioritized action items
  scoreBreakdown: {
    [category: string]: number    // per-skill scores
  }
  issuesByCategory: {
    [category: string]: { critical: number; warning: number; info: number }
  }
}
```

### HTML Report Template

The HTML report is a self-contained single file using Handlebars:
- All CSS inlined (`<style>`)
- All chart data inlined as JSON in `<script>` tags
- Score gauges as inline SVG
- Bar charts for issue distribution as inline SVG
- Markdown rendered to HTML via marked.js (inlined)
- No external dependencies — works offline

---

## 8. WebSocket Events

All WebSocket events use JSON format `{ type: string, data: object }`.

### Server → Client

```typescript
// Crawl events
{ type: 'crawl:page',     data: CrawledPageDTO }           // per page crawled
{ type: 'crawl:progress', data: { crawled: 234, queued: 89, errors: 3, pagesPerSec: 4.2 } }
{ type: 'crawl:paused',   data: { crawled: 234 } }
{ type: 'crawl:complete', data: CrawlStats }

// Audit events
{ type: 'audit:skill:start',    data: { skillName: 'seo-technical' } }
{ type: 'audit:skill:complete', data: { skillName, score, preview: string } }
{ type: 'audit:skill:error',    data: { skillName, error: string } }
{ type: 'audit:complete',       data: { overallScore, auditId } }

// Report events
{ type: 'report:generating', data: { format: 'pdf' } }
{ type: 'report:ready',      data: { reportId, downloadUrl } }
```

---

## 9. API Reference

### Authentication

```
POST /api/auth/register
  Body: { email, name, password }
  Response: { user: UserDTO }

POST /api/auth/login
  Body: { email, password }
  Response: { user: UserDTO }
  Sets: httpOnly session cookie

POST /api/auth/logout
  Clears session cookie

GET /api/auth/me
  Response: { user: UserDTO }
```

### Projects

```
GET    /api/projects                       → ProjectDTO[]
POST   /api/projects                       { name, domain, rootUrl } → ProjectDTO
GET    /api/projects/:id                   → ProjectDTO
PUT    /api/projects/:id                   { name?, description? } → ProjectDTO
DELETE /api/projects/:id                   → 204
```

### Crawls

```
POST   /api/projects/:id/crawls            { config: CrawlConfig } → CrawlSessionDTO
GET    /api/projects/:id/crawls            → CrawlSessionDTO[]
GET    /api/crawls/:id                     → CrawlSessionDTO (with stats)
DELETE /api/crawls/:id                     → 204 (cancels running crawl)

GET    /api/crawls/:id/pages               → paginated
  Query: page, pageSize, statusCode, indexable, hasIssues, search
  Response: { data: CrawledPageDTO[], total, page, pageSize }

GET    /api/crawls/:id/issues              → IssueDTO[]
  Query: category, severity
  Response: { data: IssueDTO[], totals: { critical, warning, info } }

GET    /api/crawls/:id/export              → file stream
  Query: format (csv|json)

WS     /ws/crawls/:id                      → real-time event stream
```

### Audits

```
POST  /api/projects/:id/audits             { crawlSessionId, skills: string[] } → AuditDTO
GET   /api/projects/:id/audits             → AuditDTO[]
GET   /api/audits/:id                      → AuditDTO with skillResults[]
GET   /api/audits/:id/skills/:name         → SkillResultDTO (full rawResponse)
```

### Reports

```
GET  /api/projects/:id/reports             → ReportDTO[]
GET  /api/reports/:id                      → ReportDTO
GET  /api/reports/:id/download             → file stream (html or pdf)
POST /api/reports/:id/pdf                  → triggers PDF generation job
POST /api/reports/:id/share                → { shareToken, expiresAt }
GET  /api/share/:token                     → public report (no auth)
```

---

## 10. Environment Variables

```bash
# Database (MongoDB)
DATABASE_URL=mongodb://127.0.0.1:27017/seoaifrog?replicaSet=rs0&directConnection=true
# DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/seoaifrog  # Atlas (replica set by default)

# Redis
REDIS_URL=redis://localhost:6379

# Auth
BETTER_AUTH_SECRET=<random-32-chars>
SESSION_SECRET=<random-32-chars>

# AI (OpenAI)
OPENAI_API_KEY=sk-...
# Optional: override default audit model
OPENAI_MODEL=gpt-4o

# App
PORT=3001
FRONTEND_URL=http://localhost:5173
STORAGE_PATH=./storage

# Optional: email (for auth verification)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=...
```

---

## 11. Performance Targets

| Operation | Target | Method |
|-----------|--------|--------|
| Crawl throughput | ≥ 5 pages/sec | async queue, concurrency 5, Got.js streaming |
| Page insertion | < 15ms | Prisma + MongoDB indexed writes |
| AG Grid update | < 200ms | WebSocket + AG Grid row transaction API |
| Skill API call | < 60 seconds | OpenAI API, max_tokens per `OPENAI_MODEL` |
| HTML report generation | < 30 seconds | Handlebars template rendering |
| PDF generation | < 60 seconds | Playwright page.pdf() |
| API P99 latency | < 500ms | Fastify, indexed queries |
| Concurrent crawls | ≥ 10 simultaneous | BullMQ workers, separate Redis queues |
