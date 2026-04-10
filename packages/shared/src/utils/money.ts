/**
 * Format a value in cents as a currency string (German locale, EUR default).
 * Always shows full precision to the cent — no abbreviation.
 *
 * @param cents - Amount in cents (integer)
 * @param currency - ISO 4217 currency code, defaults to "EUR"
 * @returns Formatted currency string, e.g. "1.234,56 €"
 */
export function formatCurrency(cents: number, currency: string = 'EUR'): string {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format a euro value as a full-precision currency string.
 * NO abbreviation — always shows exact value to the cent.
 *
 * @param dollars - Amount in euros/dollars (float)
 * @param currency - ISO 4217 currency code, defaults to "EUR"
 * @returns Formatted currency string, e.g. "1.234,56 €"
 */
export function formatDollars(dollars: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format a euro value as a full (non-compact) currency string.
 *
 * @param dollars - Amount in euros (float)
 * @param currency - ISO 4217 currency code, defaults to "EUR"
 * @returns Formatted currency string, e.g. "1.234,56 €"
 */
export function formatDollarsFull(dollars: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Convert cents (integer) to dollars (float).
 */
export function centsToDollars(cents: number): number {
  return cents / 100;
}

/**
 * Convert dollars (float) to cents (integer), rounding to avoid floating-point issues.
 */
export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

/**
 * Format a decimal value as a percentage string.
 *
 * @param value - Decimal ratio (0.1 = 10%)
 * @param decimals - Number of decimal places, defaults to 1
 * @returns Formatted string, e.g. "10.0%"
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format a number with German locale thousand separators.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('de-DE').format(value);
}

/**
 * Safe division that returns a fallback when dividing by zero.
 *
 * @param numerator - The numerator
 * @param denominator - The denominator
 * @param fallback - Value to return if denominator is zero, defaults to 0
 */
export function safeDiv(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0) {
    return fallback;
  }
  return numerator / denominator;
}
