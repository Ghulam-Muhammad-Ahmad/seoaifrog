# SEO AI Frog — Design System
**Version:** 2.0 · **Theme:** Claude Orange · **Date:** April 2026

---

## Design Philosophy

| Principle | Description |
|-----------|-------------|
| **Data-Dense, Not Cluttered** | SEO professionals need maximum information at a glance. Compact spacing, tight typography, and clear hierarchy present density without confusion. |
| **Trust Through Clarity** | Every number is verifiable. Show exact values, units, and data provenance. AI-generated scores are always labeled. |
| **Action-Oriented** | Every screen makes the next step obvious: Crawl → Audit → Report. |
| **Progressive Disclosure** | Summaries first, details on demand. Click rows to expand. Click score cards to read full AI analysis. |

---

## 1. Color System

### 1.1 Brand — Claude Orange Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--brand-primary` | `#D97706` | CTAs, active states, links |
| `--brand-primary-hover` | `#B45309` | Hover / pressed state |
| `--brand-primary-light` | `#FFFBEB` | Selected card backgrounds |
| `--brand-deep` | `#92400E` | Dark accents, borders on primary |
| `--brand-glow` | `#FCD34D` | Highlights, focus rings |
| `--brand-secondary` | `#EA580C` | AI / report elements, gradient end |
| `--brand-secondary-hover` | `#C2410C` | Secondary hover |
| `--brand-secondary-light` | `#FFF7ED` | Secondary card backgrounds |

### 1.2 Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#16A34A` | Good scores, 2xx HTTP codes |
| `--success-light` | `#F0FDF4` | Success backgrounds |
| `--warning` | `#CA8A04` | Medium scores, 3xx codes |
| `--warning-light` | `#FEFCE8` | Warning backgrounds |
| `--error` | `#DC2626` | Critical scores, 4xx/5xx codes |
| `--error-light` | `#FEF2F2` | Error backgrounds |
| `--info` | `#0891B2` | Informational items |
| `--info-light` | `#ECFEFF` | Info backgrounds |

### 1.3 Score Color Scale

| Range | Hex | Label |
|-------|-----|-------|
| 90–100 | `#16A34A` | **Excellent** |
| 70–89 | `#65A30D` | **Good** |
| 50–69 | `#D97706` | **Needs Work** |
| 30–49 | `#EA580C` | **Poor** |
| 0–29 | `#DC2626` | **Critical** |

### 1.4 Neutral Palette (Warm Stone)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-base` | `#FAFAF9` | App background (warm white) |
| `--bg-surface` | `#FFFFFF` | Cards, panels |
| `--bg-muted` | `#F5F5F4` | Alt rows, disabled states |
| `--bg-subtle` | `#E7E5E4` | Hovered rows |
| `--border` | `#E7E5E4` | Dividers, card borders |
| `--border-strong` | `#D6D3D1` | Table headers, inputs |
| `--text-primary` | `#1C1917` | Headings, main content |
| `--text-secondary` | `#57534E` | Secondary labels |
| `--text-muted` | `#A8A29E` | Placeholder, disabled |
| `--text-inverse` | `#FFFFFF` | On dark/brand backgrounds |

---

## 2. Typography

### 2.1 Font Families

| Role | Family | CSS Token | Notes |
|------|--------|-----------|-------|
| Display | **Plus Jakarta Sans** | `--font-display` | Headlines, section titles — confident & modern |
| Body / UI | **IBM Plex Sans** | `--font-sans` | Excellent legibility at small sizes |
| Monospace | **JetBrains Mono** | `--font-mono` | URLs, codes, scores, data values |

### 2.2 Type Scale

| Role | Size | Weight | Line-height | Usage |
|------|------|--------|------------|-------|
| Display | 36px | 800 | 1.1 | Landing page hero |
| H1 | 24px | 700 | 1.25 | Page titles |
| H2 | 20px | 600 | 1.3 | Section headers |
| H3 | 16px | 600 | 1.4 | Card headers, sub-sections |
| Body | 14px | 400 | 1.5 | Default UI text |
| Small | 12px | 400 | 1.4 | Labels, metadata, helper text |
| Mono | 12px | 400 | 1.4 | URLs, status codes, data values |
| Mono Large | 14px | 500 | 1.4 | Score numbers, key data |

---

## 3. Spacing

Uses a 4px base unit:

| Token | Value | Usage |
|-------|-------|-------|
| `sp-1` | 4px | Minimum padding |
| `sp-2` | 8px | Badge, small button padding |
| `sp-3` | 12px | Default button padding |
| `sp-4` | 16px | Card padding, form field padding |
| `sp-6` | 24px | Section spacing, modal padding |
| `sp-8` | 32px | Large section gaps |
| `sp-12` | 48px | Page section separation |

---

## 4. Components

### 4.1 Score Gauge (SVG Arc)

**Sizes:** Small (80px) · Large (140px)

**Anatomy:**
- Track arc: full circle, 8px stroke, `--bg-muted`
- Value arc: partial circle, 8px stroke, score color, `stroke-linecap: round`
- Center: score number in `--font-mono font-bold`
- Below number (large only): label text (Excellent / Good / etc.)

**Animation:** Count-up from 0 → final value, 600ms ease-out. Arc draws simultaneously.

```svg
<!-- Small variant (80px) -->
<svg width="80" height="80" viewBox="0 0 80 80" aria-label="Score: {score} out of 100">
  <circle cx="40" cy="40" r="32" fill="none" stroke="var(--bg-muted)" stroke-width="8"/>
  <circle cx="40" cy="40" r="32" fill="none"
    stroke="{scoreColor}"
    stroke-width="8"
    stroke-linecap="round"
    stroke-dasharray="{(score/100) * 201} 201"
    transform="rotate(-90 40 40)"/>
  <text x="40" y="44" text-anchor="middle"
    font-family="JetBrains Mono"
    font-weight="700"
    font-size="18">{score}</text>
</svg>
```

---

### 4.2 Issue Severity Badges

| Variant | Background | Text | Border | Icon |
|---------|-----------|------|--------|------|
| Critical | `#FEF2F2` | `#B91C1C` | `#FECACA` | `CircleDot` |
| Warning | `#FEFCE8` | `#854D0E` | `#FEF08A` | `AlertTriangle` |
| Info | `#FFFBEB` | `#92400E` (brand) | `#FDE68A` | `Info` |
| Success | `#F0FDF4` | `#15803D` | `#BBF7D0` | `CheckCircle` |

**HTTP Status Codes:**

| Code | Background | Text |
|------|-----------|------|
| 2xx | `#DCFCE7` | `#15803D` |
| 3xx | `#FEFCE8` | `#854D0E` |
| 4xx | `#FEE2E2` | `#B91C1C` |
| 5xx | `#FEE2E2` | `#991B1B` (bold) |
| 0 / timeout | `#F5F5F4` | `#78716C` |

---

### 4.3 Buttons

| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| Primary | `--brand-primary` | white | — | `--brand-primary-hover` |
| Secondary | white | `--text-primary` | `--border-strong` | `--bg-muted` |
| Danger | `--error` | white | — | `#B91C1C` |
| Ghost | transparent | `--text-secondary` | — | `--bg-muted` |
| Icon | transparent | `--text-secondary` | — | `--bg-muted` |

All buttons: `border-radius: 8px`, `font-size: 13px`, `font-weight: 600`, `padding: 9px 18px`

**Focus:** `outline: 2px solid var(--brand-glow)` + `outline-offset: 2px`

---

### 4.4 Form Elements

```
Input
  border: 1px solid var(--border-strong)
  border-radius: 8px
  padding: 9px 12px
  font-size: 13px
  focus: border --brand-primary, box-shadow 0 0 0 3px rgba(217,119,6,0.18)
  error: border --error, box-shadow 0 0 0 3px rgba(220,38,38,0.12)

Label
  font-size: 12px
  font-weight: 600
  color: --text-secondary

Error message
  font-size: 11px
  color: --error

Helper text
  font-size: 11px
  color: --text-muted
```

---

### 4.5 Cards

| Type | Radius | Padding | Shadow | Notes |
|------|--------|---------|--------|-------|
| Default | 12px | 24px | `shadow-sm` | Static content groups |
| Hover (project) | 12px | 24px | `shadow-md` on hover | Cursor pointer, translateY(-1px) |
| Stat | 12px | 16px | `shadow-sm` | Value 28px bold mono, label 11px uppercase |
| Skill | 12px | — | hover shadow | 260px wide, togglable, selected = brand border |

**Skill Card Selected State:**
```
border: 2px solid var(--brand-primary)
background: var(--brand-primary-light)
```

---

### 4.6 AG Grid Theme

**Base theme:** `ag-theme-alpine`

| Variable | Value |
|----------|-------|
| `--ag-font-size` | `13px` |
| `--ag-row-height` | `36px` |
| `--ag-header-height` | `40px` |
| `--ag-row-hover-color` | `rgba(217,119,6,0.06)` |
| `--ag-selected-row-background-color` | `rgba(217,119,6,0.12)` |
| `--ag-header-background-color` | `var(--bg-muted)` |

**URL column:** `font-mono 12px`, color `--brand-primary`, ellipsis overflow

**Title Length:**
- `< 30 chars` → `#EA580C` (too short)
- `30–60 chars` → `#16A34A` (optimal)
- `> 60 chars` → `#D97706` (too long)

**Word Count:**
- `< 300` → `#DC2626` (thin)
- `300–500` → `#D97706` (low)
- `≥ 500` → `--text-primary` (OK)

**Row Severity Left Border:**
- CRITICAL: `border-left: 4px solid var(--error)`
- WARNING: `border-left: 4px solid var(--brand-primary)`

---

### 4.7 Progress Indicators

**Crawl bar:**
```
height: 8px
border-radius: 4px
fill: --brand-primary
track: --bg-muted
transition: width 300ms ease-out
```

**Skill audit row states:**
- Complete: solid fill `--success`, ✓ badge
- Running: animated shimmer sweep (1.5s linear infinite)
- Queued: empty track, muted label

---

## 5. Layout

### 5.1 App Shell

```
Header:     56px  — logo (160px) + breadcrumbs + user avatar
Sidebar:    220px fixed — nav, account, plan badge, usage bar
Content:    flex-1, overflow-y-auto, px-6 py-6
Max-width:  1400px centered
```

### 5.2 Crawl View

```
Toolbar (48px)   — status, counts, pause, export
Tabs (40px)      — All / HTML / Images / Issues / Redirects
Filter bar (36px)— status, indexable, category, search
Grid (flex-1)    — AG Grid, virtual scroll, streams during crawl
Detail panel (320px) — right side, visible on row click
```

### 5.3 Report View

```
Report header    — domain, date, download buttons
Hero section     — overall gauge + score breakdown bars + issue summary
Left nav (200px) — Summary / Technical / Content / Images / Schema…
Content area     — scrollable AI markdown sections per skill
```

---

## 6. Motion

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Score gauge | Arc draw + count-up | 600ms | ease-out |
| Grid row insertion | Fade in | 150ms | ease-in |
| Detail panel | Slide in from right | 200ms | ease-out |
| Skill card select | Background + border | 150ms | ease-in-out |
| Progress bar fill | Width | 300ms | ease-out |
| Toast in | Slide up | 200ms | ease-out |
| Toast out | Fade | 150ms | ease-in |
| Page transition | Fade | 150ms | ease-in-out |
| Shimmer | Sweep | 1.5s | linear ∞ |

> **Rule:** UI must feel snappy (< 200ms for interactions). No gratuitous animation — every motion communicates state change.

---

## 7. Icons (lucide-react)

| Skill | Icon |
|-------|------|
| seo-technical | `Wrench` |
| seo-content | `FileText` |
| seo-images | `Image` |
| seo-schema | `Code2` |
| seo-sitemap | `Map` |
| seo-hreflang | `Globe` |
| seo-geo | `Bot` |
| seo-page | `Layout` |
| seo-plan | `Target` |
| seo-programmatic | `Database` |
| seo-competitor-pages | `SplitSquareHorizontal` |
| seo-audit | `ShieldCheck` |
| seo-performance | `Gauge` |

**Standard sizes:** 12px (inline badges) · 16px (default UI) · 20px (headers) · 24px (empty states)

---

## 8. Accessibility

- All interactive elements: `focus-visible` ring `2px solid var(--brand-glow)` + `outline-offset: 2px`
- Color is never the only differentiator — always pair with icon or text
- Score gauges: `aria-label="Score: {score} out of 100"`
- Form fields: associated `<label>` (not just placeholder)
- Minimum touch target: 44×44px
- AG Grid columns: `headerName` required for screen readers
- WCAG 2.1 AA target

---

## 9. Tailwind Config

```typescript
// tailwind.config.ts
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary:           '#D97706',
          'primary-hover':   '#B45309',
          'primary-light':   '#FFFBEB',
          deep:              '#92400E',
          glow:              '#FCD34D',
          secondary:         '#EA580C',
          'secondary-hover': '#C2410C',
          'secondary-light': '#FFF7ED',
        },
        stone: {
          base:    '#FAFAF9',
          muted:   '#F5F5F4',
          subtle:  '#E7E5E4',
          border:  '#D6D3D1',
        },
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans:    ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono:    ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        card:  '12px',
        badge: '6px',
      },
    },
  },
}
```

---

## 10. Dark Mode

Deferred to v2.1. Design tokens use Tailwind `class` strategy for zero-refactor addition later. Dark mode will use `stone-900` backgrounds and `stone-100` text with amber/orange accent preservation.

---

*SEO AI Frog Design System v2.0 — Claude Orange Theme*