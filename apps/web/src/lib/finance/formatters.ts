/**
 * Finance-specific formatting utilities.
 *
 * Most components already import from @filapen/shared/src/utils/money,
 * but these helpers provide additional convenience for dashboard display.
 */

export function formatCurrency(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}

export function formatROAS(value: number | null): string {
  if (value === null) return '\u2014';
  return `${value.toFixed(2)}x`;
}
