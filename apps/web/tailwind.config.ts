import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary: Vibrant Indigo-Violet — das neue Signatur-Lila
        // Light mode: tief sattes Lila  |  Dark mode: heller zum Kontrast
        primary: {
          50: '#F4F1FF',
          100: '#E9E3FF',
          200: '#D0C3FF',
          300: '#B09AFF',
          400: '#8C6FFF',
          500: '#6548FF',  // Haupt-Primary, deutlich lebendiger als alte Blau-Variante
          600: '#5234E5',
          700: '#4327BC',
          800: '#361F94',
          900: '#2B1877',
          950: '#1A0D4E',
          DEFAULT: '#6548FF',
        },
        // Module-Akzentfarben — jedes Hub/Modul hat seine Signaturfarbe
        // damit die Sidebar + Dashboards sofort visuell erkennbar sind
        'accent-sales': {
          light: '#FFE4DA',
          DEFAULT: '#FF7A59',
          dark: '#C94A2D',
        },
        'accent-shipping': {
          light: '#CFFAFE',
          DEFAULT: '#06B6D4',
          dark: '#0E7490',
        },
        'accent-finance': {
          light: '#D1FAE5',
          DEFAULT: '#10B981',
          dark: '#047857',
        },
        'accent-creator': {
          light: '#FCE7F3',
          DEFAULT: '#EC4899',
          dark: '#9D174D',
        },
        'accent-work': {
          light: '#FEF3C7',
          DEFAULT: '#F59E0B',
          dark: '#B45309',
        },
        'accent-content': {
          light: '#EDE9FE',
          DEFAULT: '#8B5CF6',
          dark: '#6D28D9',
        },
        'accent-email': {
          light: '#FFE4E6',
          DEFAULT: '#F43F5E',
          dark: '#BE123C',
        },
        'accent-influencer': {
          light: '#FAE8FF',
          DEFAULT: '#D946EF',
          dark: '#A21CAF',
        },
        'accent-purchase': {
          light: '#DBEAFE',
          DEFAULT: '#3B82F6',
          dark: '#1D4ED8',
        },
        'accent-documents': {
          light: '#E0E7FF',
          DEFAULT: '#6366F1',
          dark: '#3730A3',
        },
        semantic: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#6548FF',
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
        // Hero-Gradients fürs Dashboard
        'gradient-hero': 'linear-gradient(135deg, #6548FF 0%, #A855F7 50%, #EC4899 100%)',
        'gradient-hero-subtle': 'linear-gradient(135deg, rgba(101, 72, 255, 0.15) 0%, rgba(168, 85, 247, 0.1) 50%, rgba(236, 72, 153, 0.08) 100%)',
        'gradient-sunset': 'linear-gradient(135deg, #FF7A59 0%, #F59E0B 50%, #EC4899 100%)',
        'gradient-ocean': 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 50%, #6548FF 100%)',
        'gradient-forest': 'linear-gradient(135deg, #10B981 0%, #06B6D4 50%, #3B82F6 100%)',
        // Dark-Mode: tiefere Gradients
        'gradient-hero-dark': 'linear-gradient(135deg, #2B1877 0%, #6548FF 50%, #8B5CF6 100%)',
        // Mesh-Gradient für Hero-Hintergrund (radial)
        'gradient-mesh': 'radial-gradient(at 20% 30%, rgba(101, 72, 255, 0.25) 0px, transparent 50%), radial-gradient(at 80% 10%, rgba(236, 72, 153, 0.2) 0px, transparent 50%), radial-gradient(at 50% 80%, rgba(6, 182, 212, 0.15) 0px, transparent 50%)',
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
