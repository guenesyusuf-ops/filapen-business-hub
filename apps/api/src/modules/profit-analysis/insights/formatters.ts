/**
 * Deterministische deutsche Formatierungen fuer Insight-Texte.
 * Diese Formatierungen sind Teil der Fallback-Loesung (§33) — funktionieren
 * ohne LLM.
 */

const nfEur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const nfPct = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});
const nfDate = new Intl.DateTimeFormat('de-DE', {
  year: 'numeric', month: '2-digit', day: '2-digit',
});
const nfRoas = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtEur(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return nfEur.format(n);
}

export function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return nfPct.format(n) + ' %';
}

export function fmtSignedPct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return sign + nfPct.format(n) + ' %';
}

export function fmtRoas(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return nfRoas.format(n);
}

export function fmtDate(d: Date): string {
  return nfDate.format(d);
}

export function fmtDateRange(from: Date, to: Date): string {
  return `${fmtDate(from)}–${fmtDate(to)}`;
}

export function channelLabel(channel?: string): string {
  switch (channel) {
    case 'webshop': return 'Webshop';
    case 'amazon':  return 'Amazon';
    case 'tiktok':  return 'TikTok';
    case 'wholesale': return 'Großhandel';
    case 'total':   return 'Gesamt';
    default: return '';
  }
}
