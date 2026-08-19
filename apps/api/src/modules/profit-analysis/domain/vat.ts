import { D, toD, ONE, HUNDRED, round2 } from './decimal';

/**
 * Berechnet den Netto-Anteil aus einem Bruttobetrag.
 * Formel: Netto = Brutto / (1 + Rate/100)
 *
 * Wichtig: rate ist in Prozent (19, 7), NICHT als Dezimalzahl (0.19, 0.07).
 * Bei rate = 0 -> Netto = Brutto (kein Herausrechnen).
 */
export function netFromGross(gross: number | string | D, ratePercent: number | string | D): D {
  const g = toD(gross);
  const r = toD(ratePercent);
  if (r.isZero()) return g;
  const factor = ONE.plus(r.div(HUNDRED));
  return g.div(factor);
}

/**
 * Berechnet den USt-Anteil aus einem Bruttobetrag.
 * Formel: USt = Brutto − Netto = Brutto × Rate / (100 + Rate)
 */
export function vatFromGross(gross: number | string | D, ratePercent: number | string | D): D {
  const g = toD(gross);
  const r = toD(ratePercent);
  if (r.isZero()) return toD(0);
  return g.minus(netFromGross(g, r));
}

/**
 * Berechnet Brutto aus Netto.
 * Formel: Brutto = Netto × (1 + Rate/100)
 */
export function grossFromNet(net: number | string | D, ratePercent: number | string | D): D {
  const n = toD(net);
  const r = toD(ratePercent);
  if (r.isZero()) return n;
  return n.times(ONE.plus(r.div(HUNDRED)));
}

// -----------------------------------------------------------------------------
// Gemischte USt (19 % + 7 %)
// -----------------------------------------------------------------------------

export interface MixedVatInput {
  gross19: number | string | D;
  gross7: number | string | D;
  returns19?: number | string | D;
  returns7?: number | string | D;
  vatStandard?: number | string | D;   // Default: 19
  vatReduced?: number | string | D;    // Default: 7
}

export interface MixedVatResult {
  grossTotal: D;         // gross19 + gross7 (ohne Retouren-Abzug)
  returnsTotal: D;       // returns19 + returns7
  grossAdjusted: D;      // grossTotal - returnsTotal
  net19: D;              // Netto-Anteil 19 % Bereich (nach Retouren)
  net7: D;               // Netto-Anteil 7 % Bereich (nach Retouren)
  netAdjusted: D;        // net19 + net7
  vat19: D;              // USt-Anteil 19 % Bereich (nach Retouren)
  vat7: D;               // USt-Anteil 7 % Bereich (nach Retouren)
  vatTotal: D;           // vat19 + vat7
}

/**
 * Berechnet Netto und USt fuer einen Tages-Kanal-Umsatz mit gemischten
 * USt-Saetzen und optionalen Retouren.
 *
 * Logik:
 *   1. Fuer jeden USt-Topf: adjusted = gross - returns
 *   2. Netto + USt aus dem adjusted-Wert herausrechnen
 *   3. Gesamtwerte summieren
 *
 * Negative Werte werden geclampt (returns > gross ergibt netAdjusted = 0),
 * um Rueckerstattungs-Ueberschuss ohne Verlust darzustellen.
 */
export function calculateMixedVat(input: MixedVatInput): MixedVatResult {
  const gross19 = toD(input.gross19);
  const gross7 = toD(input.gross7);
  const ret19 = toD(input.returns19 ?? 0);
  const ret7 = toD(input.returns7 ?? 0);
  const rate19 = toD(input.vatStandard ?? 19);
  const rate7 = toD(input.vatReduced ?? 7);

  const grossTotal = gross19.plus(gross7);
  const returnsTotal = ret19.plus(ret7);
  const grossAdjusted = grossTotal.minus(returnsTotal);

  const gross19Adj = maxZero(gross19.minus(ret19));
  const gross7Adj = maxZero(gross7.minus(ret7));

  const net19 = netFromGross(gross19Adj, rate19);
  const net7 = netFromGross(gross7Adj, rate7);
  const vat19 = gross19Adj.minus(net19);
  const vat7 = gross7Adj.minus(net7);

  return {
    grossTotal,
    returnsTotal,
    grossAdjusted,
    net19,
    net7,
    netAdjusted: net19.plus(net7),
    vat19,
    vat7,
    vatTotal: vat19.plus(vat7),
  };
}

/** Sicherstellen dass ein Betrag nicht unter 0 rutscht. */
function maxZero(v: D): D {
  return v.lt(0) ? toD(0) : v;
}

/** Gerundete Api-Form von MixedVatResult (2 Nachkommastellen fuer Geldbetraege). */
export function roundMixedVat(r: MixedVatResult): MixedVatResult {
  return {
    grossTotal: round2(r.grossTotal),
    returnsTotal: round2(r.returnsTotal),
    grossAdjusted: round2(r.grossAdjusted),
    net19: round2(r.net19),
    net7: round2(r.net7),
    netAdjusted: round2(r.netAdjusted),
    vat19: round2(r.vat19),
    vat7: round2(r.vat7),
    vatTotal: round2(r.vatTotal),
  };
}
