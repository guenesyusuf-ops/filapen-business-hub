/**
 * Stabile Farb-Zuordnung pro User. Wird genutzt im Urlaubs-Kalender damit
 * jeder Mitarbeiter wiedererkennbar ist und bei mehreren Urlaubern am
 * gleichen Tag der Hintergrund split-gradient gerendert werden kann.
 *
 * Palette ist auf Light- und Dark-Mode lesbar abgestimmt — mittlere
 * Saettigung, kein Neon. 14 Farben reichen fuer typische Teams; ueber
 * Modulo werden weitere User wieder auf bestehende Farben gemappt.
 */

const USER_COLOR_PALETTE = [
  { bg: '#fbbf24', text: '#78350f', name: 'amber' },     // amber-400
  { bg: '#34d399', text: '#064e3b', name: 'emerald' },   // emerald-400
  { bg: '#60a5fa', text: '#1e3a8a', name: 'sky' },       // blue-400
  { bg: '#a78bfa', text: '#4c1d95', name: 'violet' },    // violet-400
  { bg: '#f472b6', text: '#831843', name: 'rose' },      // pink-400
  { bg: '#fb923c', text: '#7c2d12', name: 'orange' },    // orange-400
  { bg: '#22d3ee', text: '#155e75', name: 'cyan' },      // cyan-400
  { bg: '#a3e635', text: '#365314', name: 'lime' },      // lime-400
  { bg: '#facc15', text: '#713f12', name: 'yellow' },    // yellow-400
  { bg: '#f87171', text: '#7f1d1d', name: 'red' },       // red-400
  { bg: '#818cf8', text: '#312e81', name: 'indigo' },    // indigo-400
  { bg: '#2dd4bf', text: '#134e4a', name: 'teal' },      // teal-400
  { bg: '#c084fc', text: '#581c87', name: 'purple' },    // purple-400
  { bg: '#fda4af', text: '#881337', name: 'softrose' },  // rose-300
] as const;

/** Deterministischer Hash → palette-index. */
function hashStringToIndex(s: string, modulo: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % modulo;
}

export interface UserColor {
  bg: string;
  text: string;
  name: string;
}

export function colorForUser(userId: string | null | undefined): UserColor {
  if (!userId) return USER_COLOR_PALETTE[0];
  const idx = hashStringToIndex(userId, USER_COLOR_PALETTE.length);
  return USER_COLOR_PALETTE[idx];
}

/**
 * CSS-Background fuer mehrere User auf demselben Tag: linear-gradient mit
 * harten Farbstops, sodass jeder Mitarbeiter gleich grossen Anteil bekommt.
 * Bei 1 Farbe → Solid, bei 2 → halb/halb, bei 3+ → gleichgrosse Streifen.
 */
export function splitGradient(colors: UserColor[]): string {
  if (colors.length === 0) return 'transparent';
  if (colors.length === 1) return colors[0].bg;
  const step = 100 / colors.length;
  const stops = colors
    .map((c, i) => `${c.bg} ${i * step}%, ${c.bg} ${(i + 1) * step}%`)
    .join(', ');
  return `linear-gradient(90deg, ${stops})`;
}
