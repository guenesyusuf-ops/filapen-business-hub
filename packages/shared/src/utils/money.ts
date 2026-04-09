/**
 * Format a value in cents as a currency string.
 *
 * @param cents - Amount in cents (integer)
 * @param currency - ISO 4217 currency code, defaults to "USD"
 * @returns Formatted currency string, e.g. "$1,234.56"
 */
export function formatCurrency(cents: number, currency: string = 'USD'): string {
  const dollars = centsToDollars(cents);
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format a dollar value as a compact currency string.
 * For values >= 1M shows "$1.1M", >= 1K shows "$12.3K", else "$123.45".
 *
 * @param dollars - Amount in dollars (float)
 * @param currency - ISO 4217 currency code, defaults to "USD"
 * @returns Formatted compact currency string
 */
export function formatDollars(dollars: number, currency: string = 'USD'): string {
  const abs = Math.abs(dollars);
  const sign = dollars < 0 ? '-' : '';

  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    return `${sign}$${val >= 10 ? val.toFixed(1) : val.toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    const val = abs / 1_000;
    return `${sign}$${val >= 100 ? val.toFixed(0) : val.toFixed(1)}K`;
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(dollars);
}

/**
 * Format a dollar value as a full (non-compact) currency string.
 *
 * @param dollars - Amount in dollars (float)
 * @param currency - ISO 4217 currency code, defaults to "USD"
 * @returns Formatted currency string, e.g. "$1,234.56"
 */
export function formatDollarsFull(dollars: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
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
 * Format a number with locale-aware thousand separators.
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
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
