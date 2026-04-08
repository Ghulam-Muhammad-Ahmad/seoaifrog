import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#D97706',
          'primary-hover': '#B45309',
          'primary-light': '#FFFBEB',
          deep: '#92400E',
          glow: '#FCD34D',
          secondary: '#EA580C',
          'secondary-hover': '#C2410C',
          'secondary-light': '#FFF7ED',
        },
        surface: {
          base: 'var(--bg-base)',
          card: 'var(--bg-surface)',
          muted: 'var(--bg-muted)',
          subtle: 'var(--bg-subtle)',
        },
        line: {
          DEFAULT: 'var(--border)',
          strong: 'var(--border-strong)',
        },
        ink: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          inverse: 'var(--text-inverse)',
        },
        semantic: {
          success: '#16A34A',
          'success-light': '#F0FDF4',
          warning: '#CA8A04',
          'warning-light': '#FEFCE8',
          error: '#DC2626',
          'error-light': '#FEF2F2',
          info: '#0891B2',
          'info-light': '#ECFEFF',
        },
      },
      fontFamily: {
        display: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        sans: ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        card: '12px',
        badge: '6px',
      },
      maxWidth: {
        shell: '1400px',
      },
      spacing: {
        header: '56px',
        sidebar: '220px',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease-out forwards',
        grain: 'grain 8s steps(10) infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        grain: {
          '0%, 100%': { transform: 'translate(0, 0)' },
          '10%': { transform: 'translate(-5%, -10%)' },
          '30%': { transform: 'translate(3%, -15%)' },
          '50%': { transform: 'translate(12%, 9%)' },
          '70%': { transform: 'translate(9%, 4%)' },
          '90%': { transform: 'translate(-1%, 7%)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
