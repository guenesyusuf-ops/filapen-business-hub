/**
 * Format a Date as YYYY-MM-DD string.
 */
export function formatDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date range as "YYYY-MM-DD - YYYY-MM-DD".
 */
export function formatDateRange(start: Date, end: Date): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

/**
 * Get a preset date range relative to today (UTC).
 */
export function getPresetDateRange(
  preset: 'today' | '7d' | '30d' | '90d' | 'ytd',
): { start: Date; end: Date } {
  const end = startOfDayUTC(new Date());

  switch (preset) {
    case 'today':
      return { start: new Date(end), end };

    case '7d':
      return { start: addDays(end, -6), end };

    case '30d':
      return { start: addDays(end, -29), end };

    case '90d':
      return { start: addDays(end, -89), end };

    case 'ytd': {
      const start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
      return { start, end };
    }

    default: {
      const _exhaustive: never = preset;
      throw new Error(`Unknown preset: ${_exhaustive}`);
    }
  }
}

/**
 * Get the previous period of equal length for comparison.
 * E.g. if the range is 7 days, the comparison is the 7 days before that.
 */
export function getComparisonRange(
  start: Date,
  end: Date,
): { start: Date; end: Date } {
  const durationMs = end.getTime() - start.getTime();
  const compEnd = new Date(start.getTime() - 1);
  const compStart = new Date(compEnd.getTime() - durationMs);
  return {
    start: startOfDayUTC(compStart),
    end: startOfDayUTC(compEnd),
  };
}

/**
 * Return a new Date set to the start of the day in UTC.
 */
export function startOfDayUTC(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Add (or subtract) a number of days from a date, returning a new Date.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
