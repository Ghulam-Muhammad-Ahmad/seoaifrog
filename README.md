# SEO AI Frog

**Screaming Frog meets AI — crawl any website locally and generate comprehensive AI-powered SEO audit reports.**

SEO AI Frog is a SaaS application that combines local website crawling (like Screaming Frog) with OpenAI models to produce detailed, written SEO audit reports with prioritized action plans.

---

## Features

### Crawler (Screaming Frog-style)

- Crawl any public website up to 50,000 pages
- Real-time AG Grid data table — rows stream in as pages are crawled
- 40+ SEO columns: status codes, title tags, meta descriptions, headings, links, images, schema, Core Web Vitals
- Optional JavaScript rendering mode (Playwright) for React/Next.js/Vue SPAs
- Configurable depth, concurrency, URL filters, crawl delay
- Respects robots.txt by default
- XML sitemap parsing to seed additional URLs
- Export crawl data as CSV or JSON

### AI-Powered Audits (13 Specialized Skills)

- **seo-technical** — Crawlability, redirects, canonicals, indexability, security
- **seo-content** — E-E-A-T signals, readability, thin content, AI citation readiness
- **seo-images** — Alt text coverage, file sizes, formats, lazy loading, CLS risk
- **seo-schema** — JSON-LD validation, schema types, rich result eligibility
- **seo-sitemap** — Sitemap validation, coverage analysis
- **seo-hreflang** — International SEO, return tag validation
- **seo-geo** — AI Overview optimization, llms.txt, passage citability
- **seo-page** — Deep single-page analysis (top 10 pages)
- **seo-plan** — Strategic SEO roadmap with industry templates
- **seo-programmatic** — Programmatic page analysis at scale
- **seo-competitor-pages** — Comparison page opportunities
- **seo-audit** — Master synthesis audit
- **seo-performance** — Core Web Vitals analysis

### Comprehensive Reports

- AI-written executive summary
- Overall score (0-100) with category breakdown
- Prioritized action plan (Critical → High → Medium → Low)
- Export as self-contained HTML, PDF (A4), or JSON
- Shareable links (72-hour expiry, no login required)

### SaaS Ready

- Email + password authentication
- Multi-project organization by domain
- Historical crawl comparison (track improvements over time)
- Plan tiers: FREE / PRO / AGENCY
- Usage tracking and plan limit enforcement
- API key access (AGENCY plan)

---

## Tech Stack


| Layer              | Technology                                                  |
| ------------------ | ----------------------------------------------------------- |
| Frontend           | React 18 + Vite + TypeScript                                |
| UI                 | shadcn/ui + Tailwind CSS                                    |
| Data Grid          | AG Grid Community (virtual scrolling)                       |
| Server State       | TanStack Query v5                                           |
| Backend            | Fastify v4 + TypeScript                                     |
| Database           | Prisma + MongoDB (`db push`; Atlas or self-hosted)          |
| Job Queue          | BullMQ + Redis                                              |
| Authentication     | Better Auth                                                 |
| Crawler (static)   | Got.js + Cheerio                                            |
| Crawler (JS sites) | Playwright                                                  |
| AI                 | OpenAI API (`gpt-4o` default; override with `OPENAI_MODEL`) |
| Monorepo           | Turborepo                                                   |


---

## Quick Start

### Prerequisites

- Node.js 20 LTS or later
- Redis (see Docker option below)
- An OpenAI API key — get one at [platform.openai.com](https://platform.openai.com)

### 1. Clone and Install

```bash
git clone <repository-url>
cd seoaifrog
npm install
```

### 2. Configure Environment

Copy environment files and edit values:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
```

The API loads environment variables in this order (later wins):

1. **Repo root** `.env` at `seoaifrog/.env` (optional shared defaults)
2. `**apps/api/.env`** (recommended — overrides root)

You need `**DATABASE_URL`** in at least one of those files. Minimum `apps/api/.env`:

```env
DATABASE_URL=mongodb://127.0.0.1:27017/seoaifrog?replicaSet=rs0&directConnection=true
REDIS_URL=redis://localhost:6379
SESSION_SECRET=use-a-long-random-string-at-least-32-chars
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o
PORT=3001
FRONTEND_URL=http://localhost:5173
STORAGE_PATH=./storage
```

### 3. Start Redis and MongoDB

```bash
# Using Docker (recommended) — Mongo runs as a single-node replica set (required by Prisma)
docker compose up -d
# Includes redis, mongodb (replica set), and a one-shot `mongo-init` — wait until it exits successfully.

# Or use MongoDB Atlas — already a replica set; use their connection string as DATABASE_URL
```

**Prisma + MongoDB:** Prisma uses transactions for some writes; MongoDB must be a **replica set**. The Compose file starts `mongod --replSet rs0` and runs `docker/mongo-rs-init.js` once. Your `DATABASE_URL` must include `replicaSet=rs0` and, when connecting from the host to Docker, `directConnection=true` (see `.env.example`).

### 4. Set Up Database

Prisma syncs the **MongoDB** schema with `prisma db push` (the `db:migrate` script runs that).

```bash
npm run db:migrate
```

**Playwright (optional):** Crawls with **Render JavaScript** use headless Chromium. After `npm install`, install the browser once:

```bash
npx playwright install chromium
```

### 5. Start Development Servers

```bash
npm run dev
```

This starts:

- Frontend at [http://localhost:5173](http://localhost:5173)
- API at [http://localhost:3001](http://localhost:3001)
- Crawl and audit BullMQ workers (started together with the API in `apps/api`’s `dev` script)

**Redis must be running** (`docker compose up -d` or local Redis) or jobs stay queued and crawl status remains `PENDING`.

To run only the HTTP API (no workers), from `apps/api` run `tsx watch src/server.ts`, then in separate terminals:

```bash
npm run worker:crawl -w @seoaifrog/api
npm run worker:audit -w @seoaifrog/api
```

### Troubleshooting


| Error                                                           | What to do                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL` / `Environment variable not found: DATABASE_URL` | Add `DATABASE_URL` to `**apps/api/.env**` or repo `**.env**`, then restart the API.                                                                                                                                                                                                  |
| `ECONNREFUSED` on port **6379**                                 | Start Redis: `docker compose up -d redis` (or install Redis locally).                                                                                                                                                                                                                |
| `ECONNREFUSED` proxying `/api/...` in Vite                      | **API is not on port 3001.** In another terminal run `npm run dev:api` (or stop and run `npm run dev` again). In dev, the API starts even if Redis was down; **crawls/audits still need Redis** + workers.                                                                           |
| Crawl fails: **Could not start Chromium** / Playwright errors   | Run `npx playwright install chromium` from the repo (or `apps/api`). In Docker/Linux servers you may need `--no-sandbox` (already passed by the crawler).                                                                                                                            |
| Mongo connection errors                                         | Run `docker compose up -d` (starts `mongo-init` once), then `npm run db:migrate`.                                                                                                                                                                                                    |
| Prisma **P2031** / “replica set”                                | Use a replica-set URL (see `.env.example`). With Docker, run `docker compose up -d` so `mongo-init` runs; set `DATABASE_URL` with `?replicaSet=rs0&directConnection=true`. If you changed Mongo mode, you may need `docker compose down -v` once (wipes local DB) and migrate again. |


---

## Project Structure

```
seoaifrog/
├── apps/
│   ├── web/              # React + Vite frontend
│   │   └── src/
│   │       ├── components/
│   │       │   ├── crawler/    # CrawlerGrid, toolbar, sidebar
│   │       │   ├── audit/      # SkillSelector, AuditProgress
│   │       │   └── reports/    # ReportViewer, ScoreGauge
│   │       └── pages/          # Dashboard, Crawl, Audit, Reports
│   │
│   └── api/              # Fastify backend
│       └── src/
│           ├── crawler/   # CrawlEngine + 7 extractors + IssueDetector
│           ├── ai/        # OpenAIClient + AuditOrchestrator + ReportBuilder
│           ├── jobs/      # BullMQ workers
│           └── routes/    # REST API endpoints
│
├── packages/
│   └── shared/           # TypeScript types shared between web and api
│
├── docs/
│   ├── PRD.md            # Product Requirements Document
│   ├── SPEC.md           # Technical Specification
│   └── DESIGN-SYSTEM.md  # Design system and component specs
│
└── docker-compose.yml    # Redis + MongoDB (dev)
```

---

## Usage

### Running a Crawl

1. Sign in and create a project (enter your domain URL)
2. Click **New Crawl**
3. Configure settings:
  - Enter the start URL
  - Set max pages (default: 500)
  - Toggle JS rendering on for React/Vue/Next.js sites
  - Optionally add URL include/exclude filters
4. Click **Start Crawl**
5. Watch pages appear in the data grid in real time
6. Click any row to see full SEO details in the right panel
7. Use the tabs (HTML / Images / Issues / Redirects) to filter the view
8. Export to CSV when done

### Running an AI Audit

1. From a completed crawl, click **Run AI Audit**
2. Select which skills to run (or choose a preset):
  - **Full Audit** — all 13 skills (~20 minutes)
  - **Technical Only** — 4 technical skills (~8 minutes)
  - **Content Only** — 4 content skills (~8 minutes)
  - **Quick Scan** — 2 core skills (~5 minutes)
3. Click **Start Audit**
4. Watch each skill complete with a score in real time
5. Click **Generate Report** when all skills are done

### Viewing and Sharing Reports

1. Go to **Reports** for your project
2. Click a report to view it in the browser
3. Click **Download HTML** for a self-contained file (works offline)
4. Click **Download PDF** for a print-ready A4 document
5. Click **Share** to generate a 72-hour share link for clients

---

## Development

### Available Commands

```bash
# Development
npm run dev              # Start all apps in development mode
npm run dev:web          # Start frontend only
npm run dev:api          # Start backend only

# Database
npm run db:migrate       # Prisma db push → MongoDB
npm run db:studio        # Open Prisma Studio (database browser)
npm run db:reset         # Reset database (⚠ destructive)

# Building
npm run build            # Build all packages
npm run build:web        # Build frontend only
npm run build:api        # Build backend only

# Code Quality
npm run lint             # ESLint across all packages
npm run typecheck        # TypeScript check across all packages
npm run test             # Run test suite
```

### Adding a New SEO Skill

1. Add your skill prompt file to `apps/api/src/ai/skills/your-skill.md`
2. Add a payload builder in `apps/api/src/ai/PayloadBuilder.ts`
3. Add it to the appropriate execution group in `apps/api/src/ai/AuditOrchestrator.ts`
4. Add a skill card definition in `apps/web/src/components/audit/SkillSelector.tsx`

---

## Configuration

### Crawl Configuration Options


| Option            | Default       | Description                                |
| ----------------- | ------------- | ------------------------------------------ |
| `maxPages`        | 500           | Maximum pages to crawl                     |
| `maxDepth`        | 10            | Maximum link depth from start URL          |
| `concurrency`     | 5             | Parallel request workers                   |
| `crawlDelay`      | 100           | Milliseconds between requests (per domain) |
| `userAgent`       | SEOAiFrog/1.0 | User agent string sent with requests       |
| `respectRobots`   | true          | Honor robots.txt directives                |
| `renderJs`        | false         | Use Playwright for JS rendering            |
| `jsWaitMs`        | 2000          | Milliseconds to wait for JS to render      |
| `followRedirects` | true          | Follow HTTP redirects                      |
| `includeNoindex`  | true          | Crawl noindex pages (flagged but included) |


### Plan Limits


| Limit            | FREE | PRO        | AGENCY            |
| ---------------- | ---- | ---------- | ----------------- |
| Pages per crawl  | 500  | 5,000      | 50,000            |
| Projects         | 3    | Unlimited  | Unlimited         |
| Audits/month     | 5    | 50         | 500               |
| Skills available | 5    | 13         | 13                |
| Report formats   | HTML | HTML + PDF | HTML + PDF + JSON |


---

## Production Deployment

### 1. Production MongoDB

Use [MongoDB Atlas](https://www.mongodb.com/atlas) or a managed cluster. Set:

```
DATABASE_URL=mongodb+srv://user:password@cluster.mongodb.net/seoaifrog?retryWrites=true&w=majority
```

Then run:

```bash
npm run db:migrate
```

### 2. Deploy with Docker

```bash
docker-compose -f docker-compose.prod.yml up -d
```

This starts:

- API server (Fastify)
- Frontend (served via nginx)
- BullMQ workers
- Redis
- MongoDB

### 3. Process Management (without Docker)

```bash
# Install PM2
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# View logs
pm2 logs

# Monitor
pm2 monit
```

---

## Environment Variables Reference

```env
# Database (required)
DATABASE_URL=mongodb://127.0.0.1:27017/seoaifrog?replicaSet=rs0&directConnection=true

# Redis (required for job queues)
REDIS_URL=redis://localhost:6379

# Auth (required — use random 32+ character strings)
BETTER_AUTH_SECRET=
SESSION_SECRET=

# AI (required)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o

# App
PORT=3001
FRONTEND_URL=http://localhost:5173
STORAGE_PATH=./storage               # where reports/files are saved

# Email — optional (for email verification and password reset)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@yourdomain.com

# Production: MongoDB Atlas SRV URL
# DATABASE_URL=mongodb+srv://user:pass@cluster.mongodb.net/seoaifrog
```

---

## Documentation


| Document                                  | Description                                             |
| ----------------------------------------- | ------------------------------------------------------- |
| [PRD.md](docs/PRD.md)                     | Product requirements, user stories, plan tiers          |
| [SPEC.md](docs/SPEC.md)                   | Technical specification, database schema, API reference |
| [DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Colors, typography, components, layout                  |


---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run checks: `npm run lint && npm run typecheck && npm run test`
5. Submit a pull request

---

## License

MIT — see [LICENSE](LICENSE) for details.