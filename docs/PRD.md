# SEO AI Frog — Product Requirements Document (PRD)

**Version:** 1.0
**Date:** 2026-04-04
**Status:** Approved for Development

---

## 1. Product Overview

**Product Name:** SEO AI Frog
**Tagline:** Screaming Frog meets AI — audit any website in minutes

### Problem Statement

SEO audits are slow, expensive, and require expert knowledge. Existing tools either:
- Only surface raw data without explanation (Screaming Frog, Sitebulb)
- Are expensive SaaS platforms with monthly subscription costs (Ahrefs, Semrush)
- Require manual analysis to turn data into actionable written recommendations

### Solution

A SaaS tool that:
1. Crawls websites locally (fast, no API rate limits, full control)
2. Automatically extracts every SEO signal from every page
3. Uses OpenAI models with specialized SEO skill prompts to generate comprehensive written audit reports
4. Produces client-ready HTML and PDF reports with prioritized action plans

---

## 2. Target Users

| Persona | Description | Primary Job-to-Be-Done |
|---------|-------------|------------------------|
| Solo SEO Consultant | Freelancer auditing 5-20 client sites/month | Generate client-ready reports in 30 minutes instead of 2 days |
| Digital Agency | Team managing 20+ client websites | Batch-audit sites, white-label reports, track improvement over time |
| In-House SEO Manager | Single person at a 50-500 person company | Find technical issues without spending hours in Screaming Frog |
| SaaS/Tech Startup Founder | Non-expert wanting to improve organic growth | Run a self-serve audit without needing SEO expertise to interpret results |

---

## 3. Core Features — v1.0

### F1: Website Crawler (Screaming Frog-style)

**What it does:**
- Crawls any publicly accessible website starting from a seed URL
- Follows internal links recursively up to configured depth
- Extracts all SEO-relevant data from every page

**Key behaviors:**
- Respects robots.txt by default (configurable)
- Configurable crawl concurrency (default 5 parallel requests)
- Configurable crawl delay between requests (default 100ms)
- Handles redirects (301, 302, etc.) and captures full redirect chains
- Optional JavaScript rendering mode for React/Next.js/Vue SPAs (uses Playwright)
- URL filtering by include/exclude regex patterns
- Parses XML sitemaps to seed additional URLs
- Real-time progress: pages stream into the data grid as they are crawled

**Data extracted per page:**
- URL, HTTP status code, content type, response time, page size
- Title tag (text + character count)
- Meta description (text + character count)
- Meta robots (noindex, nofollow, etc.)
- Canonical URL (and whether it matches the page URL)
- Open Graph tags (og:title, og:description, og:image, og:type)
- H1–H6 heading structure (count + text of each)
- Internal link count + external link count
- All links with anchor text and rel attributes
- All images with src, alt text, width/height, loading attribute
- Schema markup (JSON-LD, Microdata, RDFa)
- Word count of visible body text
- Readability score (Flesch-Kincaid)
- Content fingerprint (MD5 hash for duplicate detection)
- Hreflang tags (language and region)
- Core Web Vitals: LCP, CLS, TTFB (JS mode only)

**Plan limits:**
- FREE: 500 pages per crawl
- PRO: 5,000 pages per crawl
- AGENCY: 50,000 pages per crawl

---

### F2: AI-Powered SEO Audit

**What it does:**
- Analyzes crawl data using 13 specialized AI skills (OpenAI)
- Each skill sends relevant crawl data to the model with an expert SEO prompt
- Each skill returns a score (0–100) and a detailed written analysis

**The 13 audit skills:**

| Skill | Focus Area |
|-------|-----------|
| seo-technical | Crawlability, indexability, redirects, canonicals, robots, security |
| seo-content | E-E-A-T signals, readability, thin content, AI citation readiness |
| seo-images | Alt text coverage, file sizes, formats, lazy loading, CLS risk |
| seo-schema | JSON-LD validation, schema types, rich result eligibility |
| seo-sitemap | XML sitemap validation, coverage vs crawled URLs |
| seo-hreflang | International SEO, hreflang tag validation, return tag check |
| seo-geo | AI Overview optimization, llms.txt, passage citability |
| seo-page | Deep single-page analysis (top 10 most important pages) |
| seo-plan | Strategic SEO plan with industry-specific roadmap |
| seo-programmatic | Programmatic page analysis, thin content at scale |
| seo-competitor-pages | Comparison page opportunities |
| seo-audit | Master synthesis skill — overall site assessment |
| seo-performance | Core Web Vitals analysis (when Playwright data available) |

**Execution presets:**
- Full Audit: all 13 skills
- Technical Only: seo-technical, seo-sitemap, seo-schema, seo-hreflang
- Content Only: seo-content, seo-page, seo-images, seo-geo
- Quick Scan: seo-technical + seo-content (fastest, ~5 minutes)

**Plan limits:**
- FREE: 5 skills per audit, 5 audits/month
- PRO: all 13 skills, 50 audits/month
- AGENCY: all 13 skills, 500 audits/month

---

### F3: Comprehensive Reports

**What it does:**
- Compiles all skill results into a unified, branded report document
- AI generates an executive summary synthesizing all findings

**Report contents:**
1. Executive Summary (AI-written, 3 paragraphs)
2. Overall Score (0–100, weighted average of skill scores)
3. Critical Issues list (sorted by severity)
4. Per-skill sections (full AI analysis with score)
5. Prioritized Action Plan (Critical → High → Medium → Low)
6. Site statistics (pages crawled, issue counts by category)

**Export formats:**
- HTML (self-contained single file, opens in any browser)
- PDF (A4, print-ready, generated via Playwright)
- JSON (machine-readable, for custom integrations)

**Sharing:**
- Generate a shareable URL with 72-hour expiry (no login required to view)

---

### F4: Project Management

- Organize crawls and audits by domain (project)
- View crawl history per project
- Compare scores between audit runs (track improvements)
- Re-run audit on the same crawl data with different skills
- Re-crawl and compare with previous crawl

---

### F5: SaaS Fundamentals

- Email + password authentication
- Email verification
- Password reset flow
- API key generation (AGENCY plan)
- Team seats (PRO: 3 seats, AGENCY: unlimited)
- Usage dashboard (pages crawled, AI skills used, reports generated this month)

---

## 4. User Stories

### Crawler

```
As a user, I can enter any URL and start a crawl within 30 seconds of signing in.
As a user, I can see each page appear in the data grid in real time as it is crawled.
As a user, I can filter the grid by: status code, content type, indexability, or issue type.
As a user, I can sort any column ascending or descending.
As a user, I can click any row to see all extracted SEO data for that page in a detail panel.
As a user, I can toggle column groups on/off (e.g., hide performance columns to focus on content).
As a user, I can pause a crawl and resume it later.
As a user, I can cancel a crawl at any time.
As a user, I can export the full crawl data as a CSV file.
As a user, I can configure: max pages, max depth, crawl speed, JS rendering, URL filters.
```

### Audit

```
As a user, I can start an AI audit from any completed crawl.
As a user, I can select which skills to run using toggle cards.
As a user, I can use a preset (Full / Technical / Content / Quick Scan).
As a user, I can see each skill's progress in real time (queued → running → done with score).
As a user, I can read each skill's written analysis immediately after it completes.
```

### Reports

```
As a user, I can generate an HTML report from any completed audit.
As a user, I can download the report as a PDF.
As a user, I can share a report link with my client (no login required, 72h expiry).
As a user, I can view my report history for each project.
As a user, I can compare overall scores between two audits.
```

### Account

```
As a user, I can create an account and run my first crawl for free immediately.
As a user, I can see my usage this month (pages, skills, reports) vs my plan limit.
As a user, I can upgrade my plan from the dashboard.
As an AGENCY user, I can generate API keys to integrate report generation into my own tools.
```

---

## 5. Plan Tiers

| Feature | FREE | PRO ($49/mo) | AGENCY ($199/mo) |
|---------|------|-------------|-----------------|
| Projects | 3 | Unlimited | Unlimited |
| Max pages per crawl | 500 | 5,000 | 50,000 |
| Audits per month | 5 | 50 | 500 |
| Skills available | 5 of 13 | All 13 | All 13 |
| Report formats | HTML only | HTML + PDF | HTML + PDF + JSON |
| Shareable report links | No | Yes | Yes |
| Team seats | 1 | 3 | Unlimited |
| API access | No | No | Yes |
| Data retention | 30 days | 6 months | 2 years |
| Priority support | No | Email | Dedicated Slack |

---

## 6. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Crawl throughput | ≥ 5 pages/second on default settings |
| AI skill response time | ≤ 60 seconds per skill |
| HTML report generation | ≤ 30 seconds |
| PDF report generation | ≤ 60 seconds |
| WebSocket latency (crawl events) | ≤ 200ms from crawl to grid update |
| API response time (99th percentile) | ≤ 500ms (excluding crawl/audit jobs) |
| Monthly uptime | ≥ 99.5% |
| Authentication security | bcrypt password hashing, httpOnly session cookies |
| Data isolation | Row-level isolation per user; no cross-user data access |

---

## 7. Out of Scope — v1.0

The following will NOT be built in v1.0:

- Backlink analysis (requires third-party APIs — Ahrefs/Majestic)
- Keyword rank tracking
- SERP analysis or position monitoring
- Competitor analysis (domain vs domain)
- Browser extension
- Mobile app (iOS/Android)
- White-label / custom branding for reports
- Zapier / webhook integrations
- Built-in Slack/email notifications for completed audits

---

## 8. Success Metrics

| Metric | 30-day Target | 90-day Target |
|--------|--------------|--------------|
| Signups | 500 | 2,000 |
| Crawls completed | 1,000 | 5,000 |
| AI audits run | 500 | 2,500 |
| PRO conversions | 25 | 100 |
| Report downloads | 300 | 1,500 |
| User NPS | > 40 | > 50 |
