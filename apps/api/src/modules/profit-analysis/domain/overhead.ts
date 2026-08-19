import { D, toD, ONE, HUNDRED, round2 } from './decimal';
import { netFromGross } from './vat';
import { costRatio } from './margin';

export type OverheadCategory =
  | 'miete' | 'lager' | 'loehne' | 'steuerberater' | 'software'
  | 'auto_rate' | 'auto_versicherung' | 'sonstiges' | 'speditionskosten' | 'verpackung';

export const OVERHEAD_CATEGORIES: Array<{ key: OverheadCategory; label: string }> = [
  { key: 'miete',            label: 'Miete' },
  { key: 'lager',            label: 'Lager' },
  { key: 'loehne',           label: 'Löhne' },
  { key: 'steuerberater',    label: 'Steuerberater' },
  { key: 'software',         label: 'Software' },
  { key: 'auto_rate',        label: 'Auto Rate' },
  { key: 'auto_versicherung',label: 'Auto Versicherung' },
  { key: 'speditionskosten', label: 'Speditionskosten' },
  { key: 'verpackung',       label: 'Verpackung' },
  { key: 'sonstiges',        label: 'Sonstiges' },
];

export interface OverheadEntryInput {
  category: string;
  label: string;
  enteredAmount: number | string | D;
  isGross: boolean;
  vatRate: number | string | D;
}

export interface OverheadEntryResult extends OverheadEntryInput {
  netAmount: D;
  vatAmount: D;
  grossAmount: D;
}

/**
 * Berechnet Netto/USt/Brutto einer einzelnen Kostenposition abhaengig vom
 * eingegebenen brutto/netto-Kennzeichen.
 *
 * Wichtig: das System trifft KEINE Aussage darueber ob Vorsteuer abziehbar
 * ist (Master-Prompt §45). isGross ist reine Eingabe-Info.
 */
export function calculateOverheadEntry(input: OverheadEntryInput): OverheadEntryResult {
  const entered = toD(input.enteredAmount);
  const rate = toD(input.vatRate);
  let netAmount: D, grossAmount: D;
  if (input.isGross) {
    grossAmount = entered;
    netAmount = rate.isZero() ? entered : netFromGross(entered, rate);
  } else {
    netAmount = entered;
    grossAmount = rate.isZero() ? entered : entered.times(ONE.plus(rate.div(HUNDRED)));
  }
  return {
    ...input,
    netAmount,
    vatAmount: grossAmount.minus(netAmount),
    grossAmount,
  };
}

/** Aggregat aller Kostenpositionen eines Monats. */
export interface OverheadTotals {
  entries: OverheadEntryResult[];
  totalNet: D;
  totalGross: D;
  totalVat: D;
  byCategory: Record<string, { totalNet: D; ratioOfNetSales: D | null }>;
}

export function aggregateOverhead(
  entries: OverheadEntryInput[],
  totalMonthlyNetSales: number | string | D,
): OverheadTotals {
  const results = entries.map(calculateOverheadEntry);
  const totalNet   = results.reduce((acc, r) => acc.plus(r.netAmount),   toD(0));
  const totalGross = results.reduce((acc, r) => acc.plus(r.grossAmount), toD(0));
  const totalVat   = results.reduce((acc, r) => acc.plus(r.vatAmount),   toD(0));

  // Nach Kategorie gruppieren + Prozent-Anteil am Gesamt-Netto-Umsatz (§54)
  const byCategory: Record<string, { totalNet: D; ratioOfNetSales: D | null }> = {};
  for (const r of results) {
    const cat = r.category;
    if (!byCategory[cat]) byCategory[cat] = { totalNet: toD(0), ratioOfNetSales: null };
    byCategory[cat].totalNet = byCategory[cat].totalNet.plus(r.netAmount);
  }
  for (const cat of Object.keys(byCategory)) {
    byCategory[cat].ratioOfNetSales = costRatio(byCategory[cat].totalNet, totalMonthlyNetSales);
  }

  return { entries: results, totalNet, totalGross, totalVat, byCategory };
}

export function roundOverheadTotals(o: OverheadTotals): OverheadTotals {
  return {
    entries: o.entries.map((r) => ({
      ...r,
      netAmount: round2(r.netAmount),
      vatAmount: round2(r.vatAmount),
      grossAmount: round2(r.grossAmount),
    })),
    totalNet: round2(o.totalNet),
    totalGross: round2(o.totalGross),
    totalVat: round2(o.totalVat),
    byCategory: Object.fromEntries(
      Object.entries(o.byCategory).map(([k, v]) => [k, { totalNet: round2(v.totalNet), ratioOfNetSales: v.ratioOfNetSales }]),
    ),
  };
}
