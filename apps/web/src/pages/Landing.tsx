import { useState, useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle,
  Clock,
  Code2,
  Cpu,
  FileText,
  Gauge,
  Globe,
  ImageIcon,
  Layers,
  Link2,
  Menu,
  Minus,
  Plus,
  Radar,
  Search,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  X,
  Zap,
} from 'lucide-react'

// ─── Intersection-observer reveal wrapper ────────────────────────────────────
function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => el.classList.add('in-view'), delay)
          ob.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [delay])

  return (
    <div ref={ref} className={`section-reveal ${className}`}>
      {children}
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
  ]

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled ? 'nav-scrolled' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-6 md:px-10">
        {/* Logo */}
        <Link to="/" className="focus-ring flex items-center gap-2.5 rounded-lg">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary shadow-sm">
            <Radar className="h-4 w-4 text-white" aria-hidden />
          </div>
          <span className="font-display text-[1.05rem] font-extrabold tracking-tight text-brand-deep">
            SEO AI Frog
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main navigation">
          {navLinks.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="focus-ring rounded-md font-sans text-sm font-semibold text-ink-secondary transition hover:text-ink-primary"
            >
              {label}
            </a>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden items-center gap-3 md:flex">
          <Link
            to="/login"
            className="focus-ring rounded-lg px-3 py-2 font-sans text-sm font-semibold text-ink-secondary hover:text-ink-primary"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary-hover"
          >
            Get started free
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="focus-ring rounded-lg p-2 text-ink-secondary md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-line bg-white/96 px-6 py-4 backdrop-blur-lg md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navLinks.map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="rounded-lg px-3 py-2.5 font-sans text-base font-semibold text-ink-secondary hover:bg-surface-muted"
                onClick={() => setOpen(false)}
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-line pt-4">
            <Link
              to="/login"
              className="rounded-lg px-3 py-2.5 font-sans text-sm font-semibold text-ink-secondary hover:bg-surface-muted"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-primary px-4 py-3 font-sans text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Get started free <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden mesh-warm bg-grain pt-16">
      {/* Ambient blobs */}
      <div
        className="pointer-events-none absolute -right-32 top-24 h-[520px] w-[520px] rounded-full blur-[90px]"
        style={{ background: 'rgba(252,211,77,0.28)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-16 bottom-16 h-[400px] w-[400px] rounded-full blur-[80px]"
        style={{ background: 'rgba(234,88,12,0.1)' }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-64px)] max-w-shell flex-col justify-center px-6 py-20 md:px-10 lg:py-0">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* ── Left: copy ───────────────────────────────────────── */}
          <div>
            <p className="hero-stagger-1 mb-5 inline-flex items-center gap-2 rounded-full border border-brand-primary/25 bg-white/70 px-3.5 py-1.5 font-sans text-xs font-semibold uppercase tracking-widest text-brand-deep shadow-sm backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-brand-primary" aria-hidden />
              Crawl · Audit · Report
            </p>

            <h1 className="hero-stagger-2 font-display text-[2.4rem] font-extrabold leading-[1.07] tracking-tight text-ink-primary md:text-[3rem] xl:text-[3.4rem]">
              Technical SEO
              <br />
              intelligence,{' '}
              <span className="gradient-text">without the spreadsheet fatigue.</span>
            </h1>

            <p className="hero-stagger-3 mt-6 max-w-lg font-sans text-base leading-relaxed text-ink-secondary md:text-[1.06rem]">
              One pipeline from crawl data to AI-written reports. What used to take 2&nbsp;days
              now takes 20&nbsp;minutes — with findings your clients actually read.
            </p>

            <ul className="hero-stagger-3 mt-5 flex flex-col gap-2.5" aria-label="Key features">
              {[
                'Crawl up to 500 pages free — no API rate limits',
                '13 specialized AI audit skills powered by Claude',
                'PDF + HTML reports, white-label on Agency plan',
              ].map((point) => (
                <li key={point} className="flex items-start gap-2.5 font-sans text-sm text-ink-secondary">
                  <CheckCircle
                    className="mt-0.5 h-4 w-4 shrink-0 text-semantic-success"
                    aria-hidden
                  />
                  {point}
                </li>
              ))}
            </ul>

            <div className="hero-stagger-4 mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/register"
                className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand-primary px-7 py-3.5 font-sans text-sm font-semibold text-white shadow-md transition hover:bg-brand-primary-hover"
              >
                Start free — no card needed
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/login"
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line-strong bg-white/80 px-6 py-3.5 font-sans text-sm font-semibold text-ink-primary shadow-sm backdrop-blur-sm hover:bg-white"
              >
                View dashboard
              </Link>
            </div>
          </div>

          {/* ── Right: live crawl terminal mock ─────────────────── */}
          <div className="relative">
            <div
              className="absolute inset-4 rounded-[20px] blur-2xl"
              style={{ background: 'rgba(217,119,6,0.08)' }}
              aria-hidden
            />

            <div className="relative overflow-hidden rounded-card border border-line bg-white/92 shadow-2xl shadow-black/[0.07] backdrop-blur-md">
              {/* Chrome bar */}
              <div className="flex items-center gap-2 border-b border-line bg-surface-muted/60 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-[#FF5F57]" aria-hidden />
                <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" aria-hidden />
                <div className="h-3 w-3 rounded-full bg-[#28CA41]" aria-hidden />
                <span className="ml-3 font-mono text-xs text-ink-muted">
                  crawl_session · acmecorp.com
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-semantic-success"
                    aria-hidden
                  />
                  <span className="font-mono text-[10px] font-semibold text-semantic-success">
                    LIVE
                  </span>
                </div>
              </div>

              {/* Terminal content */}
              <div className="space-y-1.5 p-5 font-mono text-[12.5px]">
                <div className="tl-1 flex items-center gap-2 text-ink-muted">
                  <span className="text-brand-primary">$</span>
                  <span className="text-ink-secondary">
                    crawl https://acmecorp.com --depth 3
                  </span>
                </div>

                <div className="tl-2 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-semantic-success" aria-hidden />
                  <span className="text-ink-secondary">/</span>
                  <span className="text-ink-muted">200 · 1.2s · 47 links found</span>
                </div>

                <div className="tl-3 flex items-center gap-2">
                  <CheckCircle className="h-3.5 w-3.5 shrink-0 text-semantic-success" aria-hidden />
                  <span className="text-ink-secondary">/pricing</span>
                  <span className="text-ink-muted">200 · 0.8s</span>
                  <span className="ml-auto rounded bg-semantic-warning-light px-1.5 py-0.5 text-[10px] font-semibold text-semantic-warning border border-semantic-warning/20">
                    ⚠ missing H1
                  </span>
                </div>

                <div className="tl-4 flex items-center gap-2">
                  <AlertTriangle
                    className="h-3.5 w-3.5 shrink-0 text-semantic-warning"
                    aria-hidden
                  />
                  <span className="text-ink-secondary">/blog/seo-guide</span>
                  <span className="text-ink-muted">301 →</span>
                  <span className="text-brand-secondary">/blog/seo-guide/</span>
                </div>

                <div className="tl-5 flex items-center gap-2">
                  <AlertCircle
                    className="h-3.5 w-3.5 shrink-0 text-semantic-error"
                    aria-hidden
                  />
                  <span className="text-ink-secondary">/old-team</span>
                  <span className="rounded bg-semantic-error-light px-1.5 py-0.5 text-[10px] font-semibold text-semantic-error border border-semantic-error/20">
                    404
                  </span>
                </div>

                {/* AI running block */}
                <div className="tl-6 mt-3 rounded-lg border border-brand-primary/20 bg-brand-primary-light p-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 shrink-0 text-brand-primary" aria-hidden />
                    <span className="font-semibold text-brand-deep">
                      seo-technical running…
                    </span>
                    <span className="ml-auto text-ink-muted">214 / 312 pages</span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <span
                      className="h-1 w-1 animate-pulse rounded-full bg-brand-primary"
                      aria-hidden
                    />
                    Analysing canonical chains &amp; meta coverage
                    <span className="cursor-blink" aria-hidden />
                  </p>
                </div>

                {/* Score line */}
                <div className="tl-7 flex items-center gap-3 pt-1">
                  <span className="rounded-badge border border-brand-secondary/20 bg-brand-secondary-light px-2.5 py-1 font-mono text-[11px] font-semibold text-brand-secondary">
                    Score: 74/100
                  </span>
                  <span className="text-[11px] text-ink-muted">
                    3 critical · 8 warnings · 5 passed
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
const STATS = [
  { icon: Users, value: '1,200+', label: 'SEO professionals' },
  { icon: Globe, value: '48k+', label: 'Sites crawled' },
  { icon: Clock, value: '~20 min', label: 'Avg. report time' },
  { icon: Zap, value: '13', label: 'AI audit skills' },
] as const

function StatsBar() {
  return (
    <section className="border-y border-line bg-white" aria-label="Statistics">
      <div className="mx-auto max-w-shell px-6 md:px-10">
        <div className="grid grid-cols-2 divide-x divide-line md:grid-cols-4">
          {STATS.map(({ icon: Icon, value, label }, i) => (
            <Reveal key={label} delay={i * 60} className="contents">
              <div className="flex flex-col items-center px-4 py-10 text-center">
                <Icon className="mb-3 h-5 w-5 text-brand-primary" aria-hidden />
                <p className="font-display text-3xl font-extrabold text-ink-primary">{value}</p>
                <p className="mt-1 font-sans text-sm text-ink-muted">{label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── How It Works ─────────────────────────────────────────────────────────────
const STEPS = [
  {
    n: '01',
    icon: Search,
    title: 'Crawl',
    color: 'text-semantic-info',
    bg: 'bg-semantic-info-light',
    border: 'border-semantic-info/15',
    desc: 'Enter a URL and watch the live grid fill with every page, status code, title, canonical, heading structure, and link — extracted in real time.',
  },
  {
    n: '02',
    icon: Bot,
    title: 'Audit',
    color: 'text-brand-primary',
    bg: 'bg-brand-primary-light',
    border: 'border-brand-primary/15',
    desc: 'Select your crawl, pick from 13 AI skills, and fire. Claude writes detailed findings for every category — schema, content, speed, hreflang, and more.',
  },
  {
    n: '03',
    icon: FileText,
    title: 'Report',
    color: 'text-semantic-success',
    bg: 'bg-semantic-success-light',
    border: 'border-semantic-success/15',
    desc: 'Download a polished HTML or PDF report with scored sections, severity-tagged issues, and a prioritized action plan your client can read without a guide.',
  },
] as const

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative overflow-hidden border-y border-line bg-gradient-to-b from-brand-primary-light via-white to-brand-primary-light py-24"
    >
      <div
        className="pointer-events-none absolute -right-24 top-1/2 h-[420px] w-[420px] -translate-y-1/2 rounded-full blur-[100px]"
        style={{ background: 'rgba(251, 191, 36, 0.22)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-32 bottom-0 h-[320px] w-[320px] rounded-full blur-[90px]"
        style={{ background: 'rgba(234, 88, 12, 0.08)' }}
        aria-hidden
      />

      <div className="relative mx-auto max-w-shell px-6 md:px-10">
        <Reveal className="mb-14 text-center md:mb-16">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-primary/25 bg-white/90 px-3 py-1 font-sans text-xs font-semibold uppercase tracking-widest text-brand-deep shadow-sm backdrop-blur-sm">
            How It Works
          </p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-primary md:text-4xl">
            Three steps. Zero spreadsheets.
          </h2>
          <p className="mx-auto mt-4 max-w-lg font-sans text-sm leading-relaxed text-ink-secondary">
            One vertical pipeline from seed URL to client-ready PDF — no exports, no pivot tables, no
            second-guessing the crawl log.
          </p>
        </Reveal>

        <div className="mx-auto max-w-3xl">
          <ol className="relative m-0 list-none p-0" aria-label="How SEO AI Frog works">
            {STEPS.map(({ n, icon: Icon, title, desc, color, bg, border }, i) => {
              const isLast = i === STEPS.length - 1
              return (
                <Reveal key={title} delay={i * 90}>
                  <li className="relative flex gap-5 pb-0 md:gap-8">
                    {/* Left rail: icon + spine */}
                    <div className="flex w-[4.5rem] shrink-0 flex-col items-center md:w-24">
                      <div
                        className={`relative z-10 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl border bg-white shadow-md ring-4 ring-white ${border}`}
                      >
                        <div
                          className={`absolute inset-0 rounded-2xl opacity-45 ${bg}`}
                          aria-hidden
                        />
                        <Icon className={`relative z-10 h-7 w-7 ${color}`} aria-hidden />
                      </div>
                      {!isLast && (
                        <div
                          className="mt-0 flex w-px flex-1 min-h-[4.5rem] bg-gradient-to-b from-brand-primary/45 via-brand-secondary/25 to-brand-primary/15 md:min-h-[5rem]"
                          aria-hidden
                        />
                      )}
                    </div>

                    {/* Content card */}
                    <article
                      className={`min-w-0 flex-1 pb-12 ${isLast ? 'pb-0' : ''}`}
                      aria-labelledby={`how-step-${i}-title`}
                    >
                      <div className="rounded-2xl border border-line bg-white/95 p-6 shadow-sm backdrop-blur-sm md:p-7">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-muted">
                            {n}
                          </span>
                          <span className="h-px flex-1 min-w-[2rem] bg-gradient-to-r from-line to-transparent" aria-hidden />
                          <span className="rounded-full border border-brand-primary/15 bg-brand-primary-light px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-deep">
                            Step {i + 1} of {STEPS.length}
                          </span>
                        </div>
                        <h3
                          id={`how-step-${i}-title`}
                          className="mt-4 font-display text-xl font-extrabold tracking-tight text-ink-primary md:text-2xl"
                        >
                          {title}
                        </h3>
                        <p className="mt-3 font-sans text-sm leading-relaxed text-ink-secondary">
                          {desc}
                        </p>
                      </div>
                    </article>
                  </li>
                </Reveal>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Radar,
    title: 'Screaming-Frog-style Crawler',
    desc: 'Crawls any public site from a seed URL. Follows links recursively, parses sitemaps, respects robots.txt. Optional JS rendering via Playwright for React/Next.js/Vue SPAs.',
  },
  {
    icon: Bot,
    title: '13 AI Audit Skills',
    desc: 'Purpose-built Claude prompts for technical, content, schema, images, speed, hreflang, GEO, programmatic SEO, competitor pages — each producing scored, severity-tagged findings.',
  },
  {
    icon: FileText,
    title: 'Client-Ready Reports',
    desc: 'Polished HTML and PDF exports with scored sections and prioritized fix lists. White-label on Agency plan — your logo, your branding, zero "Powered by" footers.',
  },
  {
    icon: Gauge,
    title: 'Core Web Vitals',
    desc: 'LCP, CLS, and TTFB captured per page in JS rendering mode. PageSpeed Insights API built in for Google\'s official lab data alongside your crawl data.',
  },
  {
    icon: Shield,
    title: 'No Rate Limits, Ever',
    desc: 'Crawls run locally on your machine. No per-page charges. No API throttling. Configure concurrency and request delay to crawl politely at any speed.',
  },
  {
    icon: TrendingUp,
    title: 'Track Progress Over Time',
    desc: 'Every crawl and audit is saved. Run monthly audits and compare scores, resolved issues, and improvements across any date range in the project timeline.',
  },
] as const

function Features() {
  return (
    <section id="features" className="bg-white py-24">
      <div className="mx-auto max-w-shell px-6 md:px-10">
        <Reveal className="mb-16 text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted px-3 py-1 font-sans text-xs font-semibold uppercase tracking-widest text-ink-secondary">
            Features
          </p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-primary md:text-4xl">
            Everything the crawl log demands.
          </h2>
          <p className="mx-auto mt-4 max-w-xl font-sans text-base text-ink-secondary">
            Built for operators who live in the data — not dashboards that hide it behind
            pretty charts.
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <Reveal key={title} delay={i * 55}>
              <div className="feature-card h-full rounded-card border border-line bg-white p-6 shadow-sm">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-brand-primary/15 bg-brand-primary-light">
                  <Icon className="h-5 w-5 text-brand-primary" aria-hidden />
                </div>
                <h3 className="font-display text-base font-extrabold text-ink-primary">
                  {title}
                </h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-ink-secondary">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── AI Skills ────────────────────────────────────────────────────────────────
const SKILLS = [
  { name: 'seo-technical', icon: Cpu, desc: 'Crawlability, indexability, redirects, canonicals' },
  { name: 'seo-content', icon: FileText, desc: 'E-E-A-T signals, readability, thin content' },
  { name: 'seo-schema', icon: Code2, desc: 'Structured data, JSON-LD, rich result eligibility' },
  { name: 'seo-sitemap', icon: Layers, desc: 'XML sitemap validation and generation' },
  { name: 'seo-images', icon: ImageIcon, desc: 'Alt text, file formats, sizes, lazy loading' },
  { name: 'seo-performance', icon: Gauge, desc: 'Core Web Vitals, TTFB, CLS, LCP' },
  { name: 'seo-page', icon: Search, desc: 'Deep single-page on-page analysis' },
  { name: 'seo-hreflang', icon: Globe, desc: 'International SEO, hreflang validation' },
  { name: 'seo-geo', icon: Zap, desc: 'AI Overviews, ChatGPT, Perplexity optimization' },
  { name: 'seo-plan', icon: TrendingUp, desc: 'Strategic roadmap and content planning' },
  { name: 'seo-programmatic', icon: Link2, desc: 'Template engines, URL patterns, index bloat' },
  { name: 'seo-competitor-pages', icon: Users, desc: 'Comparison & alternatives page generation' },
  { name: 'seo-audit', icon: Bot, desc: 'Full-site parallel audit across all skills' },
] as const

function AISkills() {
  return (
    <section className="bg-surface-base py-24">
      <div className="mx-auto max-w-shell px-6 md:px-10">
        <Reveal className="mb-14 text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-brand-primary/25 bg-brand-primary-light px-3 py-1 font-sans text-xs font-semibold uppercase tracking-widest text-brand-deep">
            <Bot className="h-3.5 w-3.5 text-brand-primary" aria-hidden />
            AI Audit Skills
          </p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-primary md:text-4xl">
            13 specialists. One pipeline.
          </h2>
          <p className="mx-auto mt-4 max-w-lg font-sans text-sm leading-relaxed text-ink-secondary">
            Each skill is a purpose-built Claude prompt that reads your crawl data and writes
            expert-level findings — complete with scores, severity tags, and specific fixes.
          </p>
        </Reveal>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {SKILLS.map(({ name, icon: Icon, desc }, i) => (
            <Reveal key={name} delay={i * 35}>
              <div className="skill-pill flex h-full items-start gap-3 rounded-card border border-line bg-white p-4 shadow-sm">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-primary/15 bg-brand-primary-light">
                  <Icon className="h-4 w-4 text-brand-primary" aria-hidden />
                </div>
                <div>
                  <p className="font-mono text-[11px] font-semibold text-brand-deep">{name}</p>
                  <p className="mt-0.5 font-sans text-xs leading-relaxed text-ink-muted">{desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Report Preview ───────────────────────────────────────────────────────────
const SCORE_SECTIONS = [
  { label: 'Technical', score: 74, color: '#D97706' },
  { label: 'Content', score: 81, color: '#65A30D' },
  { label: 'Schema', score: 42, color: '#EA580C' },
  { label: 'Images', score: 68, color: '#D97706' },
]

const TOP_ISSUES = [
  { sev: 'critical' as const, msg: 'Schema markup missing on 28 product pages' },
  { sev: 'critical' as const, msg: '3 pages share duplicate title tags' },
  { sev: 'warning' as const, msg: '/pricing is missing an H1 — impacts keyword targeting' },
  { sev: 'warning' as const, msg: '12 images have no alt text' },
]

const CRAWL_ROWS = [
  { url: '/pricing', status: '200', title: 'Pricing', issue: '⚠ No H1', warn: true },
  { url: '/blog/seo-guide', status: '301', title: '—', issue: '→ Redirect', warn: true },
  { url: '/old-team', status: '404', title: '—', issue: '✗ Not found', err: true },
  { url: '/', status: '200', title: 'Home', issue: '✓ OK', ok: true },
  { url: '/about', status: '200', title: 'About Us', issue: '✓ OK', ok: true },
  { url: '/contact', status: '200', title: 'Contact', issue: '✓ OK', ok: true },
]

function ReportPreview() {
  const [inView, setInView] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ob = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          ob.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    ob.observe(el)
    return () => ob.disconnect()
  }, [])

  // Score ring math: r=28, circumference = 2π*28 ≈ 176
  const circ = 176
  const offset = circ * (1 - 74 / 100) // 74/100 score

  return (
    <section ref={ref} style={{ background: '#1C1917' }} className="py-24">
      <div className="mx-auto max-w-shell px-6 md:px-10">
        <Reveal className="mb-16 text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            From raw data to client-ready report.
          </h2>
          <p className="mx-auto mt-4 max-w-lg font-sans text-sm text-[#A8A29E]">
            Every metric is traceable to the URL that earned it. Every AI finding is clearly
            labeled. Trust through clarity.
          </p>
        </Reveal>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Crawl data grid mock */}
          <Reveal delay={0}>
            <div className="overflow-hidden rounded-card border border-white/10">
              {/* Header */}
              <div className="flex items-center gap-2.5 border-b border-white/10 bg-white/5 px-4 py-3">
                <Radar className="h-4 w-4 text-brand-primary" aria-hidden />
                <span className="font-mono text-xs font-semibold text-white/70">
                  crawl_data · 312 pages
                </span>
              </div>
              {/* Column headers */}
              <div className="grid grid-cols-[2fr_56px_1fr_80px] gap-2 border-b border-white/10 bg-white/3 px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-white/35">
                <span>URL</span>
                <span>Status</span>
                <span>Title</span>
                <span>Issues</span>
              </div>
              {/* Rows */}
              {CRAWL_ROWS.map((row) => (
                <div
                  key={row.url}
                  className={`grid grid-cols-[2fr_56px_1fr_80px] gap-2 border-b border-white/5 px-4 py-2.5 font-mono text-[11.5px] last:border-0 ${
                    row.err
                      ? 'bg-semantic-error/8'
                      : row.warn
                        ? 'bg-semantic-warning/6'
                        : ''
                  }`}
                >
                  <span className="truncate text-white/75">{row.url}</span>
                  <span
                    className={
                      row.err
                        ? 'text-semantic-error'
                        : row.warn
                          ? 'text-semantic-warning'
                          : 'text-semantic-success'
                    }
                  >
                    {row.status}
                  </span>
                  <span className="truncate text-white/45">{row.title}</span>
                  <span
                    className={`truncate text-[10.5px] ${
                      row.err
                        ? 'text-semantic-error'
                        : row.warn
                          ? 'text-semantic-warning'
                          : 'text-semantic-success'
                    }`}
                  >
                    {row.issue}
                  </span>
                </div>
              ))}
              <div className="px-4 py-2 font-mono text-[10px] text-white/25">
                + 306 more pages…
              </div>
            </div>
          </Reveal>

          {/* AI report card mock */}
          <Reveal delay={120}>
            <div className="overflow-hidden rounded-card border border-white/10">
              {/* Header */}
              <div className="flex items-center gap-2.5 border-b border-white/10 bg-white/5 px-4 py-3">
                <Bot className="h-4 w-4 text-brand-primary" aria-hidden />
                <span className="font-mono text-xs font-semibold text-white/70">
                  audit_report · acmecorp.com
                </span>
                <span className="ml-auto rounded-badge border border-brand-primary/25 bg-brand-primary-light/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-brand-glow">
                  AI-generated
                </span>
              </div>

              <div className="p-5">
                {/* Score ring + summary */}
                <div className="mb-6 flex items-center gap-5">
                  <div className="relative flex-shrink-0">
                    <svg
                      width="76"
                      height="76"
                      viewBox="0 0 76 76"
                      aria-label="SEO score: 74 out of 100"
                    >
                      <circle
                        cx="38"
                        cy="38"
                        r="28"
                        fill="none"
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="6"
                      />
                      <circle
                        cx="38"
                        cy="38"
                        r="28"
                        fill="none"
                        stroke="#D97706"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        strokeDashoffset={inView ? offset : circ}
                        transform="rotate(-90 38 38)"
                        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1) 0.3s' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-xl font-extrabold text-white">74</span>
                      <span className="font-mono text-[9px] text-white/45">/100</span>
                    </div>
                  </div>
                  <div>
                    <p className="font-display text-lg font-extrabold text-white">Needs Work</p>
                    <p className="mt-0.5 font-sans text-xs text-white/55">
                      3 critical · 8 warnings · 5 passed
                    </p>
                    <p className="mt-1 font-sans text-[11px] text-white/35">
                      acmecorp.com · Apr 15, 2026
                    </p>
                  </div>
                </div>

                {/* Section scores */}
                <div className="mb-5 space-y-2.5">
                  {SCORE_SECTIONS.map(({ label, score, color }) => (
                    <div key={label} className="flex items-center gap-3">
                      <span className="w-16 font-sans text-xs text-white/55">{label}</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-white/10" style={{ height: 5 }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: inView ? `${score}%` : '0%',
                            backgroundColor: color,
                            transition: 'width 1.2s cubic-bezier(0.22,1,0.36,1) 0.5s',
                          }}
                        />
                      </div>
                      <span
                        className="w-8 text-right font-mono text-xs font-semibold"
                        style={{ color }}
                      >
                        {score}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Issues list */}
                <div className="space-y-2">
                  {TOP_ISSUES.map(({ sev, msg }) => (
                    <div
                      key={msg}
                      className={`flex items-start gap-2 rounded-lg border px-3 py-2 ${
                        sev === 'critical'
                          ? 'border-semantic-error/20 bg-semantic-error/12'
                          : 'border-semantic-warning/20 bg-semantic-warning/10'
                      }`}
                    >
                      <AlertCircle
                        className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                          sev === 'critical' ? 'text-semantic-error' : 'text-semantic-warning'
                        }`}
                        aria-hidden
                      />
                      <span className="font-sans text-[11.5px] leading-relaxed text-white/75">
                        {msg}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
type PricingTier = {
  name: string
  price: string
  period: string
  tagline: string
  cta: string
  featured: boolean
  features: string[]
}

const TIERS: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'For solo explorers',
    cta: 'Get started free',
    featured: false,
    features: [
      '500 pages per crawl',
      '3 AI audits per month',
      '5 AI skills included',
      'HTML reports',
      '1 project',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: '$49',
    period: '/month',
    tagline: 'For serious consultants',
    cta: 'Start Pro free',
    featured: true,
    features: [
      '10,000 pages per crawl',
      'Unlimited AI audits',
      'All 13 AI skills',
      'PDF + HTML reports',
      'Unlimited projects',
      'PageSpeed integration',
      'Priority email support',
    ],
  },
  {
    name: 'Agency',
    price: '$149',
    period: '/month',
    tagline: 'For teams & agencies',
    cta: 'Contact sales',
    featured: false,
    features: [
      'Unlimited pages per crawl',
      'Unlimited audits',
      'All 13 AI skills',
      'White-label reports',
      '5 team seats',
      'Custom branding',
      'Dedicated support',
    ],
  },
]

function Pricing() {
  return (
    <section id="pricing" className="bg-white py-24">
      <div className="mx-auto max-w-shell px-6 md:px-10">
        <Reveal className="mb-14 text-center">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-line bg-surface-muted px-3 py-1 font-sans text-xs font-semibold uppercase tracking-widest text-ink-secondary">
            Pricing
          </p>
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-primary md:text-4xl">
            Start free. Scale when you're ready.
          </h2>
          <p className="mx-auto mt-4 max-w-md font-sans text-base text-ink-secondary">
            No surprises. No per-page charges. Cancel anytime.
          </p>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {TIERS.map((tier, i) => (
            <Reveal key={tier.name} delay={i * 80}>
              <div
                className={`pricing-card relative flex h-full flex-col rounded-card border p-7 ${
                  tier.featured
                    ? 'pricing-card-featured border-brand-primary bg-brand-primary-light shadow-xl shadow-brand-primary/10'
                    : 'border-line bg-white shadow-sm'
                }`}
              >
                {tier.featured && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3 py-1 font-sans text-xs font-semibold text-white shadow-sm">
                      <Star className="h-3 w-3" aria-hidden /> Most popular
                    </span>
                  </div>
                )}

                <div className="mb-6">
                  <p className="font-display text-sm font-extrabold uppercase tracking-wider text-brand-primary">
                    {tier.name}
                  </p>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="font-display text-4xl font-extrabold text-ink-primary">
                      {tier.price}
                    </span>
                    <span className="mb-1 font-sans text-sm text-ink-muted">{tier.period}</span>
                  </div>
                  <p className="mt-1 font-sans text-sm text-ink-secondary">{tier.tagline}</p>
                </div>

                <ul className="mb-8 flex flex-col gap-2.5" aria-label={`${tier.name} plan features`}>
                  {tier.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5">
                      <CheckCircle
                        className="mt-0.5 h-4 w-4 shrink-0 text-semantic-success"
                        aria-hidden
                      />
                      <span className="font-sans text-sm text-ink-secondary">{feat}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-auto">
                  <Link
                    to="/register"
                    className={`focus-ring block w-full rounded-lg py-3 text-center font-sans text-sm font-semibold transition ${
                      tier.featured
                        ? 'bg-brand-primary text-white shadow-sm hover:bg-brand-primary-hover'
                        : 'border border-line-strong bg-white text-ink-primary hover:bg-surface-muted'
                    }`}
                  >
                    {tier.cta}
                  </Link>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote:
      'I used to spend two days on a technical audit. Now I fire off a crawl before lunch and have a client-ready PDF by the time I\'m back. The AI findings read like something I\'d write myself.',
    name: 'Sarah Mitchell',
    role: 'Solo SEO Consultant',
    initials: 'SM',
    color: 'bg-semantic-info-light text-semantic-info',
  },
  {
    quote:
      'We run 20+ client sites. The white-label reports with our branding saved us a full day of design work per client. Schema findings alone have driven measurable ranking improvements.',
    name: 'James Kowalski',
    role: 'Head of SEO, Apex Digital',
    initials: 'JK',
    color: 'bg-brand-primary-light text-brand-primary',
  },
  {
    quote:
      'As a founder with no SEO background, I finally understand what\'s actually wrong with our site. The action plan is prioritized so I know exactly where to start. Paid for itself in the first week.',
    name: 'Priya Nair',
    role: 'Co-founder, LayerBase',
    initials: 'PN',
    color: 'bg-semantic-success-light text-semantic-success',
  },
] as const

function Testimonials() {
  return (
    <section className="bg-brand-secondary-light py-24">
      <div className="mx-auto max-w-shell px-6 md:px-10">
        <Reveal className="mb-14 text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-primary md:text-4xl">
            Operators who live in the crawl log.
          </h2>
        </Reveal>

        <div className="grid gap-6 md:grid-cols-3">
          {TESTIMONIALS.map(({ quote, name, role, initials, color }, i) => (
            <Reveal key={name} delay={i * 80}>
              <div className="quote-mark relative flex h-full flex-col rounded-card border border-line bg-white p-7 shadow-sm">
                <div className="mb-5 flex items-center gap-3 pt-4">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-extrabold ${color}`}
                    aria-hidden
                  >
                    {initials}
                  </div>
                  <div>
                    <p className="font-display text-sm font-extrabold text-ink-primary">{name}</p>
                    <p className="font-sans text-xs text-ink-muted">{role}</p>
                  </div>
                </div>
                <p className="font-sans text-sm leading-relaxed text-ink-secondary">{quote}</p>
                <div className="mt-4 flex gap-0.5" aria-label="5 stars">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      className="h-4 w-4 fill-brand-glow text-brand-glow"
                      aria-hidden
                    />
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQS = [
  {
    q: 'Is this like Screaming Frog?',
    a: 'The crawler is similar in data density — it extracts the same SEO signals (titles, metas, canonicals, headings, links, schema, Core Web Vitals). The key difference is what happens next: SEO AI Frog feeds that data directly into specialized AI prompts that write actionable findings, so you skip the manual analysis step entirely.',
  },
  {
    q: 'Does it work on JavaScript-heavy sites?',
    a: "Yes. Enable JS rendering mode when you start a crawl and it uses Playwright to render each page like a real browser — capturing dynamic content, React/Next.js/Vue apps, and Core Web Vitals (LCP, CLS, TTFB) that don't show up in plain HTTP crawls.",
  },
  {
    q: 'What AI model powers the audits?',
    a: "Audits are powered by Claude (Anthropic). Each of the 13 skills uses a purpose-built prompt trained on SEO best practices, Google's guidelines, and real-world audit patterns. The model is labeled on every finding so you always know what's AI-generated vs. raw crawl data.",
  },
  {
    q: 'Are reports white-label?',
    a: "Yes, on the Agency plan. You can add your logo, brand colors, and remove all SEO AI Frog references from the PDF and HTML output. Ideal for consultants delivering reports under their own brand.",
  },
  {
    q: 'How is pricing calculated?',
    a: "Pricing is flat-rate per plan — not per page or per crawl. Free gives you 500 pages per crawl and 3 AI audits per month. Pro gives you 10,000 pages and unlimited audits. Agency gives you unlimited everything plus white-label and team seats.",
  },
  {
    q: 'Is my crawl data stored?',
    a: "Crawl data is stored securely in your account so you can re-run audits, compare historical runs, and generate new reports without re-crawling. You can delete any project and its data at any time from the settings page.",
  },
] as const

function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-2xl px-6 md:px-10">
        <Reveal className="mb-14 text-center">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-primary md:text-4xl">
            Frequently asked questions
          </h2>
        </Reveal>

        <div className="divide-y divide-line">
          {FAQS.map(({ q, a }, i) => {
            const isOpen = open === i
            return (
              <div key={q}>
                <button
                  className="focus-ring flex w-full items-start justify-between gap-4 py-5 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-display text-base font-extrabold text-ink-primary">
                    {q}
                  </span>
                  <span className="mt-0.5 flex-shrink-0 text-brand-primary">
                    {isOpen ? (
                      <Minus className="h-4 w-4" aria-hidden />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden />
                    )}
                  </span>
                </button>
                <div
                  className="faq-answer"
                  style={{ maxHeight: isOpen ? '400px' : '0', opacity: isOpen ? 1 : 0 }}
                >
                  <p className="pb-5 font-sans text-sm leading-relaxed text-ink-secondary">{a}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ─── CTA Banner ───────────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <section
      className="relative overflow-hidden py-24"
      style={{
        background: 'linear-gradient(135deg, #D97706 0%, #EA580C 60%, #B45309 100%)',
      }}
      aria-label="Call to action"
    >
      {/* Subtle grain overlay */}
      <div className="bg-grain pointer-events-none absolute inset-0 opacity-20" aria-hidden />

      <div className="relative z-10 mx-auto max-w-2xl px-6 text-center md:px-10">
        <Reveal>
          <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
            Stop spending 2 days on audits you could run in 20 minutes.
          </h2>
          <p className="mt-6 font-sans text-base text-white/80">
            Join 1,200+ SEO professionals who ship client-ready reports without the
            spreadsheet hell.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 font-sans text-sm font-semibold text-brand-primary shadow-lg transition hover:bg-brand-primary-light"
            >
              Start free — no credit card
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/login"
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/10 px-6 py-4 font-sans text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              View dashboard
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: '#1C1917' }} className="py-16">
      <div className="mx-auto max-w-shell px-6 md:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-primary">
                <Radar className="h-4 w-4 text-white" aria-hidden />
              </div>
              <span className="font-display text-base font-extrabold tracking-tight text-white">
                SEO AI Frog
              </span>
            </div>
            <p className="mt-3 font-sans text-sm leading-relaxed text-white/45">
              Screaming Frog meets AI — audit any website in minutes. Built for operators
              who live in the crawl log.
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="mb-4 font-sans text-xs font-semibold uppercase tracking-wider text-white/35">
              Product
            </p>
            <ul className="space-y-3">
              {['Features', 'Pricing', 'How It Works', 'Changelog'].map((label) => (
                <li key={label}>
                  <a
                    href="#"
                    className="font-sans text-sm text-white/55 transition hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <p className="mb-4 font-sans text-xs font-semibold uppercase tracking-wider text-white/35">
              Resources
            </p>
            <ul className="space-y-3">
              {['Documentation', 'API Reference', 'Blog', 'Status'].map((label) => (
                <li key={label}>
                  <a
                    href="#"
                    className="font-sans text-sm text-white/55 transition hover:text-white"
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="mb-4 font-sans text-xs font-semibold uppercase tracking-wider text-white/35">
              Legal
            </p>
            <ul className="space-y-3">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy', 'Security'].map(
                (label) => (
                  <li key={label}>
                    <a
                      href="#"
                      className="font-sans text-sm text-white/55 transition hover:text-white"
                    >
                      {label}
                    </a>
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center">
          <p className="font-sans text-xs text-white/30">
            © 2026 SEO AI Frog. All rights reserved.
          </p>
          <div className="flex gap-6">
            {['Twitter', 'GitHub', 'LinkedIn'].map((platform) => (
              <a
                key={platform}
                href="#"
                className="font-sans text-xs text-white/35 transition hover:text-white/70"
              >
                {platform}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function Landing() {
  return (
    <div className="relative overflow-x-hidden">
      <Navbar />
      <main>
        <Hero />
        <StatsBar />
        <HowItWorks />
        <Features />
        <AISkills />
        <ReportPreview />
        <Pricing />
        <Testimonials />
        <FAQ />
        <CTABanner />
      </main>
      <Footer />
    </div>
  )
}
