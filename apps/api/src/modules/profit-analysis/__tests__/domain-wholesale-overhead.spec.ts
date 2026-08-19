import { describe, it, expect } from 'vitest';
import { calculateWholesaleOrder } from '../domain/wholesale';
import { calculateOverheadEntry, aggregateOverhead } from '../domain/overhead';
import { round2 } from '../domain/decimal';

// -----------------------------------------------------------------------------
// Wholesale
// -----------------------------------------------------------------------------

describe('calculateWholesaleOrder (§48)', () => {
  it('rechnet einen einfachen Auftrag korrekt', () => {
    // 400 x 3D-Stift zu 10 EUR brutto (19%), Kosten je 4 EUR
    // = 4000 brutto → 3361.34 netto → 3361.34 - 1600 = 1761.34 Gewinn
    const r = calculateWholesaleOrder([
      { quantity: 400, unitPriceGross: 10, vatRate: 19, productCostSnapshot: 4 },
    ]);
    expect(round2(r.totalGross).toString()).toBe('4000');
    expect(round2(r.totalNet).toString()).toBe('3361.34');
    expect(round2(r.totalVat).toString()).toBe('638.66');
    expect(round2(r.totalCost).toString()).toBe('1600');
    expect(round2(r.totalProfit).toString()).toBe('1761.34');
    expect(r.margin?.toString()).toBe('52.4');
  });

  it('behandelt gemischte USt-Saetze pro Position', () => {
    // Position A: 100 × 10 EUR brutto @ 19% = 840.34 netto
    // Position B: 100 × 10 EUR brutto @ 7%  = 934.58 netto
    const r = calculateWholesaleOrder([
      { quantity: 100, unitPriceGross: 10, vatRate: 19, productCostSnapshot: 4 },
      { quantity: 100, unitPriceGross: 10, vatRate: 7,  productCostSnapshot: 5 },
    ]);
    expect(round2(r.totalGross).toString()).toBe('2000');
    // 100*10/1.19 + 100*10/1.07
    expect(round2(r.totalNet).toString()).toBe('1774.92');
    expect(round2(r.totalProfit).toString()).toBe('874.92'); // netto - 400 - 500
  });

  it('leerer Auftrag: alle Werte 0, Marge NULL', () => {
    const r = calculateWholesaleOrder([]);
    expect(r.totalGross.toString()).toBe('0');
    expect(r.margin).toBeNull();
  });

  it('Kosten-Snapshot=0 bedeutet 100% Marge', () => {
    const r = calculateWholesaleOrder([
      { quantity: 10, unitPriceGross: 100, vatRate: 19, productCostSnapshot: 0 },
    ]);
    expect(round2(r.totalNet).toString()).toBe('840.34');
    expect(round2(r.totalProfit).toString()).toBe('840.34');
    expect(r.margin?.toString()).toBe('100');
  });
});

// -----------------------------------------------------------------------------
// Overhead
// -----------------------------------------------------------------------------

describe('calculateOverheadEntry (§45)', () => {
  it('isGross=true, 19%: 1190 brutto -> 1000 netto', () => {
    const r = calculateOverheadEntry({
      category: 'miete', label: 'Buero',
      enteredAmount: 1190, isGross: true, vatRate: 19,
    });
    expect(round2(r.netAmount).toString()).toBe('1000');
    expect(round2(r.vatAmount).toString()).toBe('190');
    expect(round2(r.grossAmount).toString()).toBe('1190');
  });

  it('isGross=false, 19%: 1000 netto -> 1190 brutto', () => {
    const r = calculateOverheadEntry({
      category: 'software', label: 'Software Y',
      enteredAmount: 1000, isGross: false, vatRate: 19,
    });
    expect(round2(r.netAmount).toString()).toBe('1000');
    expect(round2(r.vatAmount).toString()).toBe('190');
    expect(round2(r.grossAmount).toString()).toBe('1190');
  });

  it('vatRate=0: Netto = Brutto (kein Herausrechnen)', () => {
    const r = calculateOverheadEntry({
      category: 'sonstiges', label: 'Kleinunternehmer',
      enteredAmount: 500, isGross: true, vatRate: 0,
    });
    expect(round2(r.netAmount).toString()).toBe('500');
    expect(round2(r.vatAmount).toString()).toBe('0');
  });
});

describe('aggregateOverhead (§54)', () => {
  it('berechnet Prozent-Anteil pro Kategorie am Nettoumsatz', () => {
    const totals = aggregateOverhead([
      { category: 'miete', label: 'M', enteredAmount: 2000, isGross: false, vatRate: 0 },
      { category: 'software', label: 'S', enteredAmount: 1000, isGross: false, vatRate: 0 },
      { category: 'miete', label: 'Lager', enteredAmount: 500, isGross: false, vatRate: 0 },
    ], 100000);
    expect(round2(totals.totalNet).toString()).toBe('3500');
    expect(round2(totals.byCategory['miete'].totalNet).toString()).toBe('2500');    // 2000+500
    expect(totals.byCategory['miete'].ratioOfNetSales!.toString()).toBe('2.5');    // 2500/100000
    expect(totals.byCategory['software'].ratioOfNetSales!.toString()).toBe('1');   // 1000/100000
  });

  it('Anteil ist NULL wenn Nettoumsatz=0', () => {
    const totals = aggregateOverhead([
      { category: 'miete', label: 'M', enteredAmount: 2000, isGross: false, vatRate: 0 },
    ], 0);
    expect(totals.byCategory['miete'].ratioOfNetSales).toBeNull();
  });
});
