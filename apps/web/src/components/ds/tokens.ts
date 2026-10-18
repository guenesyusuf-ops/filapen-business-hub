/**
 * Design-System 2.0 — gemeinsame Klassen-Tokens.
 *
 * Flächen/Text/Border beziehen sich bewusst auf die Hex-CSS-Variablen aus
 * globals.css (--card-bg, --bg-*, --text-*, --border-color, --card-shadow),
 * weil diese im `.dark`-Block automatisch umschalten. Dadurch sind alle
 * DS-Komponenten ohne Pro-Komponente-`dark:`-Hacks konsistent in Light & Dark.
 *
 * Akzente nutzen die Preset-getriebene `primary-*`-Skala (→ --accent-1/2),
 * Semantik nutzt die preset-unabhängigen Farben success/warning/error/info.
 * So färbt die Nutzer-Palette nur Akzente — Flächen bleiben neutral.
 */
export const ds = {
  // Oberflächen
  canvas: 'bg-[var(--bg-primary)] text-[var(--text-primary)]',
  card: 'bg-[var(--card-bg)] border border-[var(--border-color)]',
  subtle: 'bg-[var(--bg-tertiary)]',
  hairline: 'border-[var(--border-color)]',
  shadowCard: 'shadow-[var(--card-shadow)]',

  // Text
  text: 'text-[var(--text-primary)]',
  muted: 'text-[var(--text-secondary)]',
  faint: 'text-[rgb(var(--color-text-tertiary))]',

  // Radien (exakt, unabhängig von der aufgeblähten Tailwind-Skala)
  rCard: 'rounded-[12px]',
  rControl: 'rounded-[9px]',
  rPill: 'rounded-full',

  // Fokus — sichtbarer, einheitlicher Tastatur-Fokus
  focus:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/45 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]',

  // Bewegung — ruhig, Apple-nah; respektiert prefers-reduced-motion global
  ease: 'transition-[background-color,border-color,color,box-shadow,transform] duration-150',
} as const;

export type Tone = 'ok' | 'warn' | 'crit' | 'info' | 'neutral';

/** Semantische Status-Farben — preset-unabhängig, immer eindeutig lesbar. */
export const toneClasses: Record<Tone, string> = {
  ok: 'text-success bg-success/10',
  warn: 'text-warning bg-warning/10',
  crit: 'text-error bg-error/10',
  info: 'text-primary-600 bg-primary-500/10',
  neutral: 'text-[var(--text-secondary)] bg-[var(--bg-tertiary)]',
};
