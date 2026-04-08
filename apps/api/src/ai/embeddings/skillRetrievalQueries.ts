/** User-style queries for embedding similarity (English; works across skills). */
export function skillRetrievalQueryFor(skillName: string): string {
  const q: Record<string, string> = {
    'seo-technical':
      'HTTP status codes redirects canonical URLs indexability robots meta tags crawl errors site architecture internal links response time TTFB Core Web Vitals LCP CLS performance',
    'seo-content':
      'page titles meta descriptions headings H1 word count readability content quality duplicate text body copy topics',
    'seo-images':
      'images alt text missing alt lazy load image formats dimensions file size srcset',
    'seo-schema':
      'JSON-LD structured data schema.org rich results breadcrumb product article FAQ',
    'seo-sitemap':
      'XML sitemap URLs discovered vs submitted crawl coverage orphan pages',
    'seo-hreflang':
      'hreflang alternate language regional tags international duplicate locale',
    'seo-geo':
      'entity brand mentions local signals content passages geographic relevance',
    'seo-page':
      'on-page SEO single page analysis title meta headings content links schema',
    'seo-plan':
      'site strategy roadmap priorities opportunities SEO plan',
    'seo-programmatic':
      'template pages scale thin content URL patterns indexation programmatic SEO',
    'seo-competitor-pages':
      'comparison alternatives competitor positioning features matrix',
    'seo-audit':
      'full SEO audit issues priorities technical content links performance',
    'seo-performance':
      'page speed Core Web Vitals LCP INP CLS TTFB render blocking resources',
  }
  return q[skillName] ?? `${skillName.replace(/-/g, ' ')} SEO website crawl analysis`
}
