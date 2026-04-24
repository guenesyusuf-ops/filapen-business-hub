import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary folgt dem User-Theme via CSS-Variablen.
        //   50-200  = Light-Tint (accent-1 in weiss gemischt)
        //   300-500 = accent-1 (Highlight-Farbe)
        //   600-900 = accent-2 (Struktur/Button/Active)
        //   950     = accent-2 verdunkelt
        // color-mix erlaubt Aufhellung/Verdunklung für Hover/Focus-States.
        // Browser-Support: Chrome 111+, Firefox 113+, Safari 16.2+ — passt.
        primary: {
          50:  'color-mix(in srgb, rgb(var(--accent-1)) 10%, white)',
          100: 'color-mix(in srgb, rgb(var(--accent-1)) 20%, white)',
          200: 'color-mix(in srgb, rgb(var(--accent-1)) 35%, white)',
          300: 'color-mix(in srgb, rgb(var(--accent-1)) 55%, white)',
          400: 'color-mix(in srgb, rgb(var(--accent-1)) 80%, white)',
          500: 'rgb(var(--accent-1))',
          600: 'rgb(var(--accent-2))',
          700: 'color-mix(in srgb, rgb(var(--accent-2)) 85%, black)',
          800: 'color-mix(in srgb, rgb(var(--accent-2)) 70%, black)',
          900: 'color-mix(in srgb, rgb(var(--accent-2)) 55%, black)',
          950: 'color-mix(in srgb, rgb(var(--accent-2)) 40%, black)',
          DEFAULT: 'rgb(var(--accent-2))',
        },
        // Theme-Variable Accents — mit <alpha-value> Platzhalter damit Tailwind
        // Opacity-Modifier (z.B. bg-accent-sales/15) korrekt füllt.
        'accent-sales':      'rgb(var(--color-accent-sales) / <alpha-value>)',
        'accent-shipping':   'rgb(var(--color-accent-shipping) / <alpha-value>)',
        'accent-finance':    'rgb(var(--color-accent-finance) / <alpha-value>)',
        'accent-creator':    'rgb(var(--color-accent-creator) / <alpha-value>)',
        'accent-work':       'rgb(var(--color-accent-work) / <alpha-value>)',
        'accent-content':    'rgb(var(--color-accent-content) / <alpha-value>)',
        'accent-email':      'rgb(var(--color-accent-email) / <alpha-value>)',
        'accent-influencer': 'rgb(var(--color-accent-influencer) / <alpha-value>)',
        'accent-purchase':   'rgb(var(--color-accent-purchase) / <alpha-value>)',
        'accent-documents':  'rgb(var(--color-accent-documents) / <alpha-value>)',
        'theme-1': 'rgb(var(--accent-1) / <alpha-value>)',
        'theme-2': 'rgb(var(--accent-2) / <alpha-value>)',
        'theme-3': 'rgb(var(--accent-3) / <alpha-value>)',
        'theme-4': 'rgb(var(--accent-4) / <alpha-value>)',
        brand: {
          blue:   'rgb(var(--accent-1) / <alpha-value>)',
          navy:   'rgb(var(--accent-2) / <alpha-value>)',
          amber:  'rgb(var(--accent-3) / <alpha-value>)',
          orange: 'rgb(var(--accent-4) / <alpha-value>)',
        },
        semantic: {
          success: '#10B981',
          warning: '#F2A900',
          error: '#EF4444',
          info: '#2C3E50',
        },
        // Light-Mode Surfaces — warm off-white inspired by Notion + Misso
        surface: {
          primary: '#FEFDFB',      // body bg: warm vanilla white
          secondary: '#FFFFFF',    // card bg: pure white (maximum contrast)
          tertiary: '#F7F5EF',     // subtle tinted areas
          inverse: '#0D0B1F',
        },
        border: {
          DEFAULT: '#EAE7DF',      // warm beige-gray border
          strong: '#D7D2C5',
          subtle: '#F0EDE4',
        },
      },
      fontFamily: {
        // Sans: Inter bleibt, aber wir nutzen Display-Variante für Headlines
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['InterDisplay', 'Inter', 'system-ui', 'sans-serif'],
        // Serif für WOW-Akzente — Fraunces hat mehr Charakter als generische Serif
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: {
        // Alle Radien hochgedreht — moderner, weicher, "atmend"
        'sm': '0.5rem',     // war 0.25
        'md': '0.75rem',    // war 0.375
        'lg': '1rem',       // war 0.5
        'xl': '1.25rem',    // war 0.75
        '2xl': '1.5rem',    // war 1
        '3xl': '2rem',      // neu
        '4xl': '2.5rem',    // neu — für Hero-Elemente
      },
      spacing: {
        '4.5': '1.125rem',
        '13': '3.25rem',
        '15': '3.75rem',
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
      fontSize: {
        'xxs': ['0.625rem', { lineHeight: '0.875rem' }],
        // Display-Größen für Hero-Headlines
        'display-sm': ['2rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'display-md': ['2.5rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
        'display-lg': ['3.25rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
        'display-xl': ['4rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
      },
      boxShadow: {
        // Weiche, subtil gefärbte Schatten
        'card': '0 1px 2px 0 rgba(17, 12, 44, 0.04), 0 4px 12px -2px rgba(17, 12, 44, 0.05)',
        'card-hover': '0 4px 8px 0 rgba(17, 12, 44, 0.06), 0 16px 32px -8px rgba(17, 12, 44, 0.08)',
        'card-primary': '0 4px 12px -4px rgba(101, 72, 255, 0.25), 0 8px 24px -6px rgba(101, 72, 255, 0.15)',
        'dropdown': '0 10px 40px -6px rgba(17, 12, 44, 0.12), 0 4px 12px -2px rgba(17, 12, 44, 0.06)',
        'glass': '0 8px 32px rgba(17, 12, 44, 0.08)',
        'glow-primary': '0 0 32px rgba(101, 72, 255, 0.35)',
        'glow-soft': '0 0 24px rgba(101, 72, 255, 0.15)',
        // Bento-Card-Schatten — etwas kräftiger für Depth
        'bento': '0 2px 4px rgba(17, 12, 44, 0.04), 0 12px 40px -8px rgba(17, 12, 44, 0.08)',
      },
      backgroundImage: {
        // Theme-aware Gradients — nutzen CSS-Vars, wechseln mit Theme mit.
        'gradient-hero': 'linear-gradient(135deg, rgb(var(--accent-1)) 0%, rgb(var(--accent-3)) 50%, rgb(var(--accent-4)) 100%)',
        'gradient-hero-subtle': 'linear-gradient(135deg, rgb(var(--accent-1) / 0.25) 0%, rgb(var(--accent-3) / 0.15) 50%, rgb(var(--accent-4) / 0.1) 100%)',
        'gradient-sunset': 'linear-gradient(135deg, rgb(var(--accent-3)) 0%, rgb(var(--accent-4)) 100%)',
        'gradient-ocean': 'linear-gradient(135deg, rgb(var(--accent-1)) 0%, rgb(var(--accent-2)) 100%)',
        'gradient-warm': 'linear-gradient(135deg, rgb(var(--accent-3)) 0%, rgb(var(--accent-4)) 50%, rgb(var(--accent-1)) 100%)',
        'gradient-hero-dark': 'linear-gradient(135deg, rgb(var(--accent-2)) 0%, rgb(var(--accent-1)) 50%, rgb(var(--accent-3)) 100%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'count-up': 'countUp 1s ease-out',
        'shimmer': 'shimmer 1.5s infinite linear',
        'pulse-soft': 'pulseSoft 2s infinite ease-in-out',
        'gradient': 'gradient 8s ease infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.7' } },
        countUp: { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
