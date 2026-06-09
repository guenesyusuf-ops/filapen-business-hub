/**
 * Berechnet den abgeleiteten Status einer Rechnung aus Fälligkeitsdatum + Zahlungs-Flag.
 *
 * "Bezahlt" hat Vorrang. Bei offenen Rechnungen wird basierend auf der
 * Tagesdifferenz klassifiziert:
 *   - dueDate < heute        → overdue
 *   - dueDate == heute       → due_today
 *   - 1..7 Tage in Zukunft   → due_soon
 *   - alles andere           → open
 *
 * Ohne Fälligkeitsdatum bleibt der Status "open" (kann manuell geändert
 * werden, sobald die OCR-Korrektur erfolgt ist).
 */
export type InvoiceComputedStatus = 'open' | 'due_soon' | 'due_today' | 'overdue' | 'paid';

export function computeInvoiceStatus(args: {
  dueDate: Date | string | null | undefined;
  paidAt: Date | string | null | undefined;
  now?: Date;
}): InvoiceComputedStatus {
  if (args.paidAt) return 'paid';
  if (!args.dueDate) return 'open';

  const now = args.now ?? new Date();
  const today = startOfDay(now);
  const due = startOfDay(new Date(args.dueDate));
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);

  if (diffDays < 0) return 'overdue';
  if (diffDays === 0) return 'due_today';
  if (diffDays <= 7) return 'due_soon';
  return 'open';
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export const INVOICE_STATUSES: InvoiceComputedStatus[] = [
  'open',
  'due_soon',
  'due_today',
  'overdue',
  'paid',
];
