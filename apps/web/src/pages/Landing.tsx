import { ArrowRight, Bot, Radar, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

export function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden mesh-warm bg-grain">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(105deg,transparent_40%,rgba(255,251,235,0.5)_50%,transparent_60%)]" />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-shell flex-col px-6 pb-16 pt-10 md:px-10 md:pt-16">
        <header className="mb-16 flex items-center justify-between md:mb-24">
          <span className="font-display text-xl font-extrabold tracking-tight text-brand-deep">
            SEO AI Frog
          </span>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="focus-ring rounded-lg px-3 py-2 font-sans text-sm font-semibold text-ink-secondary hover:text-ink-primary"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="focus-ring rounded-lg bg-brand-primary px-4 py-2 font-sans text-sm font-semibold text-white shadow-sm transition hover:bg-brand-primary-hover"
            >
              Get started
            </Link>
          </div>
        </header>

        <div className="grid flex-1 gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16">
          <div>
            <p className="hero-stagger-1 mb-4 inline-flex items-center gap-2 rounded-full border border-brand-primary/25 bg-white/70 px-3 py-1 font-sans text-xs font-semibold uppercase tracking-wider text-brand-deep shadow-sm backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-brand-primary" aria-hidden />
              Crawl · Audit · Report
            </p>
            <h1 className="hero-stagger-2 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-ink-primary md:text-5xl lg:text-[2.75rem] xl:text-[3.25rem]">
              Technical SEO intelligence,
              <span className="block text-brand-primary">without the spreadsheet fatigue.</span>
            </h1>
            <p className="hero-stagger-3 mt-6 max-w-xl font-sans text-base leading-relaxed text-ink-secondary md:text-lg">
              Ship audits your clients actually read. One pipeline from crawl data to AI skills to polished
              reports — built for operators who live in the crawl log.
            </p>
            <div className="hero-stagger-4 mt-10 flex flex-wrap items-center gap-4">
              <Link
                to="/register"
                className="focus-ring inline-flex items-center gap-2 rounded-lg bg-brand-primary px-6 py-3 font-sans text-sm font-semibold text-white shadow-md transition hover:bg-brand-primary-hover"
              >
                Start free
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/login"
                className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line-strong bg-white/80 px-6 py-3 font-sans text-sm font-semibold text-ink-primary shadow-sm backdrop-blur-sm hover:bg-white"
              >
                View dashboard
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-brand-glow/40 blur-3xl" />
            <div className="absolute -bottom-10 -left-4 h-40 w-40 rounded-full bg-brand-secondary/15 blur-3xl" />
            <div className="relative rounded-card border border-line bg-white/85 p-6 shadow-xl shadow-black/[0.06] backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
                <span className="font-mono text-xs font-medium text-ink-muted">crawl_session · live</span>
                <span className="rounded-badge bg-semantic-success-light px-2 py-0.5 font-mono text-[11px] font-semibold text-semantic-success">
                  200 OK
                </span>
              </div>
              <ul className="space-y-3 font-mono text-xs text-ink-secondary">
                <li className="flex items-center gap-2">
                  <Radar className="h-4 w-4 text-brand-primary" aria-hidden />
                  <span className="truncate text-ink-primary">https://example.com/pricing</span>
                </li>
                <li className="flex items-center gap-2 opacity-80">
                  <Bot className="h-4 w-4 text-brand-secondary" aria-hidden />
                  <span>seo-technical · score queued</span>
                </li>
                <li className="rounded-lg bg-surface-muted/80 px-3 py-2 text-[11px] leading-relaxed text-ink-muted">
                  Trust through clarity: every metric traceable to the URL that earned it.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
