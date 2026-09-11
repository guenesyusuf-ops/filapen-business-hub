import { describe, it, expect } from 'vitest';
import { netFromGross, vatFromGross, grossFromNet, calculateMixedVat, roundMixedVat } from '../domain/vat';
import { toD, round2 } from '../domain/decimal';

describe('netFromGross', () => {
  it('rechnet 19% korrekt: 119.00 → 100.00', () => {
    const net = netFromGross(119, 19);
    expect(round2(net).toString()).toBe('100');
  });

  it('rechnet 7% korrekt: 107.00 → 100.00', () => {
    const net = netFromGross(107, 7);
    expect(round2(net).toString()).toBe('100');
  });

  it('rechnet 19% mit Nachkommastellen: 1234.56 → 1037.45', () => {
    const net = netFromGross('1234.56', 19);
    // 1234.56 / 1.19 = 1037.4453781...
    expect(round2(net).toString()).toBe('1037.45');
  });

  it('rate=0 gibt Brutto unveraendert zurueck', () => {
    expect(round2(netFromGross(500, 0)).toString()).toBe('500');
  });

  it('Brutto=0 gibt 0 zurueck', () => {
    expect(netFromGross(0, 19).toString()).toBe('0');
  });

  it('akzeptiert String, Number, Decimal als Input', () => {
    expect(round2(netFromGross('119', 19)).toString()).toBe('100');
    expect(round2(netFromGross(119, 19)).toString()).toBe('100');
    expect(round2(netFromGross(toD('119'), toD(19))).toString()).toBe('100');
  });
});

describe('vatFromGross', () => {
  it('19%: 119 -> 19', () => {
    expect(round2(vatFromGross(119, 19)).toString()).toBe('19');
  });
  it('7%: 107 -> 7', () => {
    expect(round2(vatFromGross(107, 7)).toString()).toBe('7');
  });
  it('rate=0 gibt 0 zurueck', () => {
    expect(vatFromGross(500, 0).toString()).toBe('0');
  });
});

describe('grossFromNet', () => {
  it('19%: 100 -> 119', () => {
    expect(round2(grossFromNet(100, 19)).toString()).toBe('119');
  });
  it('rate=0 gibt Netto unveraendert zurueck', () => {
    expect(round2(grossFromNet(500, 0)).toString()).toBe('500');
  });
});

// -----------------------------------------------------------------------------
// calculateMixedVat — die kritische Funktion
// -----------------------------------------------------------------------------

describe('calculateMixedVat — Standard-Fall (nur 19%)', () => {
  it('rechnet einen reinen 19%-Umsatz korrekt', () => {
    const r = calculateMixedVat({ gross19: 1190, gross7: 0 });
    expect(round2(r.grossTotal).toString()).toBe('1190');
    expect(round2(r.net19).toString()).toBe('1000');
    expect(round2(r.net7).toString()).toBe('0');
    expect(round2(r.netAdjusted).toString()).toBe('1000');
    expect(round2(r.vat19).toString()).toBe('190');
    expect(round2(r.vat7).toString()).toBe('0');
    expect(round2(r.vatTotal).toString()).toBe('190');
  });

  it('rechnet einen reinen 7%-Umsatz korrekt', () => {
    const r = calculateMixedVat({ gross19: 0, gross7: 214 });
    expect(round2(r.net7).toString()).toBe('200');
    expect(round2(r.vat7).toString()).toBe('14');
    expect(round2(r.netAdjusted).toString()).toBe('200');
    expect(round2(r.vatTotal).toString()).toBe('14');
  });

  it('rechnet gemischt korrekt: 1190 (19%) + 107 (7%) = 1097 Netto', () => {
    const r = calculateMixedVat({ gross19: 1190, gross7: 107 });
    expect(round2(r.grossTotal).toString()).toBe('1297');
    expect(round2(r.netAdjusted).toString()).toBe('1100');    // 1000 + 100
    expect(round2(r.vatTotal).toString()).toBe('197');        // 190 + 7
  });
});

describe('calculateMixedVat — Retouren', () => {
  it('zieht Retouren vom passenden USt-Topf ab', () => {
    const r = calculateMixedVat({
      gross19: 1190, gross7: 0,
      returns19: 119, returns7: 0,
    });
    // Adjusted 19%: 1190 - 119 = 1071 -> Netto 900 + USt 171
    expect(round2(r.net19).toString()).toBe('900');
    expect(round2(r.vat19).toString()).toBe('171');
    expect(round2(r.grossAdjusted).toString()).toBe('1071');
  });

  it('behandelt Retouren beider USt-Toepfe getrennt', () => {
    const r = calculateMixedVat({
      gross19: 1190, gross7: 214,
      returns19: 119, returns7: 21.40,
    });
    // 19%: 1190-119=1071 -> Netto 900
    // 7% : 214-21.40=192.60 -> Netto 180
    expect(round2(r.net19).toString()).toBe('900');
    expect(round2(r.net7).toString()).toBe('180');
    expect(round2(r.netAdjusted).toString()).toBe('1080');
  });

  it('rechnet Ueber-Retouren vorzeichenrichtig statt zu clampen', () => {
    // Retoure > Brutto im selben Topf: das Netto MUSS negativ werden.
    // Frueher wurde hier auf 0 geclampt — der Retouren-Ueberhang verschwand
    // spurlos und der Gewinn war systematisch zu hoch.
    const r = calculateMixedVat({
      gross19: 100, gross7: 0,
      returns19: 200, returns7: 0,
    });
    expect(round2(r.gross19Adjusted).toString()).toBe('-100');
    expect(round2(r.net19).toString()).toBe('-84.03');
    expect(round2(r.vat19).toString()).toBe('-15.97');
    expect(round2(r.grossAdjusted).toString()).toBe('-100');
  });

  it('verliert eine Retoure nicht, wenn ihr USt-Topf an dem Tag keinen Umsatz hat', () => {
    // Alltagsfall: 19%-Verkaufstag, Rueckerstattung eines 7%-Artikels.
    // Frueher: net7 wurde auf 0 geclampt, die 200 EUR verschwanden komplett
    // und netAdjusted (840.34) war groesser als grossAdjusted (800).
    const r = calculateMixedVat({
      gross19: 1000, gross7: 0,
      returns19: 0, returns7: 200,
    });
    expect(round2(r.grossAdjusted).toString()).toBe('800');
    expect(round2(r.net7).toString()).toBe('-186.92');
    expect(round2(r.netAdjusted).toString()).toBe('653.42');
  });
});

describe('calculateMixedVat — konfigurierbare Rates', () => {
  it('nutzt uebergebene vatStandard/vatReduced statt Default 19/7', () => {
    // 2020 Corona-Steuersaetze: 16 / 5
    const r = calculateMixedVat({
      gross19: 116, gross7: 0,
      vatStandard: 16,
    });
    expect(round2(r.net19).toString()).toBe('100');
    expect(round2(r.vat19).toString()).toBe('16');
  });
});

describe('calculateMixedVat — Edge Cases', () => {
  it('alles 0 -> alles 0', () => {
    const r = calculateMixedVat({ gross19: 0, gross7: 0 });
    expect(r.grossTotal.toString()).toBe('0');
    expect(r.netAdjusted.toString()).toBe('0');
    expect(r.vatTotal.toString()).toBe('0');
  });

  it('grossTotal ist Netto+USt+Retouren (nicht adjusted)', () => {
    // grossTotal enthaelt keine Retouren-Bereinigung
    const r = calculateMixedVat({
      gross19: 1000, gross7: 500,
      returns19: 200, returns7: 100,
    });
    expect(round2(r.grossTotal).toString()).toBe('1500');
    expect(round2(r.returnsTotal).toString()).toBe('300');
    expect(round2(r.grossAdjusted).toString()).toBe('1200');
  });

  it('akzeptiert String-Werte im Input', () => {
    const r = calculateMixedVat({ gross19: '1190.00', gross7: '107.00' });
    expect(round2(r.netAdjusted).toString()).toBe('1100');
  });
});

// -----------------------------------------------------------------------------
// Invariante: grossAdjusted == netAdjusted + vatTotal
//
// Dieser Block ist der Grund, warum zwei kritische Rechenfehler jahrelang
// unentdeckt blieben: es gab keinen einzigen Assert auf die Grundidentitaet.
// Sie muss roh UND gerundet gelten, in jedem Vorzeichen-Fall.
// -----------------------------------------------------------------------------

describe('calculateMixedVat — Invariante Brutto = Netto + USt', () => {
  const faelle: Array<[string, Parameters<typeof calculateMixedVat>[0]]> = [
    ['nur 19%',                      { gross19: 1190, gross7: 0 }],
    ['nur 7%',                       { gross19: 0, gross7: 107 }],
    ['gemischt',                     { gross19: 1190, gross7: 107 }],
    ['mit Retouren in beiden Toepfen',{ gross19: 1190, gross7: 214, returns19: 119, returns7: 21.4 }],
    ['Retoure im Topf ohne Umsatz',  { gross19: 1000, gross7: 0, returns19: 0, returns7: 200 }],
    ['Retoure groesser als Umsatz',  { gross19: 100, gross7: 0, returns19: 200, returns7: 0 }],
    ['reiner Retourentag',           { gross19: 0, gross7: 0, returns19: 1190, returns7: 0 }],
    ['krumme Betraege',              { gross19: 9.99, gross7: 4.99, returns19: 1.11, returns7: 0.07 }],
  ];

  for (const [name, input] of faelle) {
    it(`gilt roh: ${name}`, () => {
      const r = calculateMixedVat(input);
      expect(r.netAdjusted.plus(r.vatTotal).toString())
        .toBe(r.grossAdjusted.toString());
    });

    it(`gilt gerundet: ${name}`, () => {
      const r = roundMixedVat(calculateMixedVat(input));
      expect(r.netAdjusted.plus(r.vatTotal).toString())
        .toBe(r.grossAdjusted.toString());
    });

    it(`Einzelposten summieren sich auf die Summe: ${name}`, () => {
      const r = roundMixedVat(calculateMixedVat(input));
      expect(r.net19.plus(r.net7).toString()).toBe(r.netAdjusted.toString());
      expect(r.vat19.plus(r.vat7).toString()).toBe(r.vatTotal.toString());
    });
  }

  it('grossAdjusted bleibt grossTotal minus returnsTotal', () => {
    const r = calculateMixedVat({ gross19: 1000, gross7: 0, returns19: 0, returns7: 200 });
    expect(r.grossAdjusted.toString())
      .toBe(r.grossTotal.minus(r.returnsTotal).toString());
  });
});
