import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Primary: Blaue Palette wie aktuell Live — bleibt unverändert damit
        // Finance Hub + Buttons + aktive Elemente gleich aussehen.
        primary: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
          950: '#172554',
          DEFAULT: '#2563EB',
        },
        // Harmonisches 4-Farben-System:
        //   Blautöne (Hauptstellen):  #a9c6e0  soft blue,  #2c3e50  navy
        //   Warm-Akzente (Farb-Pop):   #f2a900  amber,      #ff8c00  orange
        // Aufgeteilt auf Module: action-heavy Modules (Sales, Email, Work)
        // bekommen warme Akzente, struktur-/tool-Modules (Shipping, Content,
        // Documents, Influencer, Creator) bekommen Blautöne.
        'accent-sales': {
          light: '#FFE5C2',
          DEFAULT: '#FF8C00',     // orange — "hustle"
          dark: '#C46C00',
        },
        'accent-shipping': {
          light: '#E7F0F9',
          DEFAULT: '#A9C6E0',     // soft blue — "flow/logistics"
          dark: '#7098B8',
        },
        'accent-finance': {
          light: '#FDE9B4',
          DEFAULT: '#F2A900',     // amber — "gold/money"
          dark: '#B47E00',
        },
        'accent-creator': {
          light: '#E7F0F9',
          DEFAULT: '#A9C6E0',
          dark: '#7098B8',
        },
        'accent-work': {
          light: '#FDE9B4',
          DEFAULT: '#F2A900',     // amber — "fokus"
          dark: '#B47E00',
        },
        'accent-content': {
          light: '#E2E8EF',
          DEFAULT: '#2C3E50',     // navy — "kreativ, seriös"
          dark: '#1A2733',
        },
        'accent-email': {
          light: '#FFE5C2',
          DEFAULT: '#FF8C00',     // orange — "action"
          dark: '#C46C00',
        },
        'accent-influencer': {
          light: '#E7F0F9',
          DEFAULT: '#A9C6E0',
          dark: '#7098B8',
        },
        'accent-purchase': {
          light: '#E2E8EF',
          DEFAULT: '#2C3E50',     // navy — "procurement"
          dark: '#1A2733',
        },
        'accent-documents': {
          light: '#E7F0F9',
          DEFAULT: '#A9C6E0',
          dark: '#7098B8',
        },
        // Brand-Tokens für einfachen direkten Zugriff
        brand: {
          blue: '#A9C6E0',
          navy: '#2C3E50',
          amber: '#F2A900',
          orange: '#FF8C00',
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
        // Hero-Gradients — harmonische 4-Farben-Palette
        'gradient-hero': 'linear-gradient(135deg, #A9C6E0 0%, #F2A900 50%, #FF8C00 100%)',
        'gradient-hero-subtle': 'linear-gradient(135deg, rgba(169, 198, 224, 0.25) 0%, rgba(242, 169, 0, 0.15) 50%, rgba(255, 140, 0, 0.1) 100%)',
        'gradient-sunset': 'linear-gradient(135deg, #F2A900 0%, #FF8C00 100%)',
        'gradient-ocean': 'linear-gradient(135deg, #A9C6E0 0%, #2C3E50 100%)',
        'gradient-warm': 'linear-gradient(135deg, #F2A900 0%, #FF8C00 50%, #A9C6E0 100%)',
        'gradient-hero-dark': 'linear-gradient(135deg, #2C3E50 0%, #A9C6E0 50%, #F2A900 100%)',
        'gradient-mesh': 'radial-gradient(at 20% 30%, rgba(169, 198, 224, 0.35) 0px, transparent 50%), radial-gradient(at 80% 10%, rgba(242, 169, 0, 0.2) 0px, transparent 50%), radial-gradient(at 50% 80%, rgba(255, 140, 0, 0.15) 0px, transparent 50%)',
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
