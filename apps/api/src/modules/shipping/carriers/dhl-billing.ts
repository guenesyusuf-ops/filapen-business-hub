/**
 * DHL Billing-Number + Product Resolution.
 *
 * Reines Utility-Modul ohne Framework-Abhaengigkeiten — dadurch trivial
 * testbar und wiederverwendbar.
 *
 * Hintergrund:
 *   Eine DHL-Abrechnungsnummer ist 14 Zeichen lang:
 *     Zeichen 1-10 = EKP (Kundennummer)
 *     Zeichen 11-12 = Verfahren (Produkt-Code)
 *     Zeichen 13-14 = Teilnahme (Vertragsnummer, meist "01")
 *
 *   Verfahren-Codes (aus DHL Paket DE Versenden v2):
 *     01 → DHL Paket National        → Produkt V01PAK
 *     53 → DHL Paket International   → Produkt V53WPAK  (EU + ausserhalb EU moeglich)
 *     54 → DHL Europaket             → Produkt V54EPAK  (nur EU-Ausland, guenstiger)
 *
 *   Zentrale Regel: das im Request-Feld `product` uebermittelte Kuerzel
 *   MUSS zum Verfahren der uebermittelten `billingNumber` passen. Sonst
 *   antwortet DHL mit "unknown product".
 *
 *   Deshalb waehlt resolveDhlProduct das Produkt NICHT nach Geografie
 *   sondern nach dem Verfahren der verfuegbaren Abrechnungsnummer.
 */

export interface ParsedBillingNumber {
  raw: string;
  ekp: string;
  procedure: string;
  participation: string;
  masked: string;
}

export type BillingParseError =
  | { kind: 'empty' }
  | { kind: 'invalid_length'; length: number }
  | { kind: 'invalid_format' };

export function parseBillingNumber(
  input: string | null | undefined,
): ParsedBillingNumber | BillingParseError {
  if (!input || typeof input !== 'string') return { kind: 'empty' };
  // Leerzeichen und Bindestriche werden vom User oft "der Uebersicht halber"
  // eingesetzt — wir normalisieren still, damit sowohl "22 ZZZZZZZZ 53 01"
  // als auch "22ZZZZZZZZ5301" gleich behandelt werden.
  const cleaned = input.replace(/[\s-]/g, '');
  if (!cleaned) return { kind: 'empty' };
  if (cleaned.length !== 14) return { kind: 'invalid_length', length: cleaned.length };
  // DHL-EKPs sind heute meist rein numerisch, historisch aber auch mit
  // Buchstaben. Wir akzeptieren beides und lehnen nur Zeichen ausserhalb
  // von [A-Za-z0-9] ab.
  if (!/^[A-Za-z0-9]{14}$/.test(cleaned)) return { kind: 'invalid_format' };
  const ekp = cleaned.slice(0, 10);
  const procedure = cleaned.slice(10, 12);
  const participation = cleaned.slice(12, 14);
  return {
    raw: cleaned,
    ekp,
    procedure,
    participation,
    // 10 Zeichen anonymisiert + 4 Zeichen sichtbar (Verfahren + Teilnahme)
    // damit man in Logs nachvollziehen kann welches Produkt gemeint war,
    // ohne die EKP zu leaken.
    masked: `**********${procedure}${participation}`,
  };
}

export type ResolveResult =
  | {
      ok: true;
      product: 'V01PAK' | 'V53WPAK' | 'V54EPAK';
      billingNumber: string;
      procedure: string;
      masked: string;
      reason: string;
    }
  | {
      ok: false;
      errorCode:
        | 'DHL_INVALID_ORIGIN_COUNTRY'
        | 'DHL_MISSING_NATIONAL_BILLING_NUMBER'
        | 'DHL_MISSING_INTERNATIONAL_BILLING_NUMBER'
        | 'DHL_PRODUCT_BILLING_MISMATCH'
        | 'DHL_INVALID_CONFIGURATION';
      message: string;
    };

interface AvailableBillingNumbers {
  billingNumber?: string | null;      // National (Verfahren 01) — Legacy-Feld-Name
  billingNumberEu?: string | null;    // EU-Ausland (Legacy-Feld-Name, kann 53 oder 54 enthalten)
  billingNumberIntl?: string | null;  // International (Weltpaket, Verfahren 53)
}

interface ResolveInput {
  originCountry: string | null | undefined;
  destinationCountry: string | null | undefined;
  credentials: AvailableBillingNumbers;
  requestedShippingMethod?: string | null;
}

const EU_COUNTRIES = new Set([
  'AT','BE','BG','CY','CZ','DK','EE','ES','FI','FR','GR','HR','HU','IE',
  'IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
]);

/**
 * Zentrale Produkt-/Abrechnungsnummer-Auswahl.
 *
 * Kernregel: das Produkt ergibt sich aus dem Verfahren der Abrechnungsnummer,
 * NICHT aus der Geografie. Die Geografie entscheidet nur ob eine internationale
 * oder nationale Nummer benoetigt wird.
 */
export function resolveDhlProduct(input: ResolveInput): ResolveResult {
  // Explizite Ueberschreibung durch den User respektieren (z.B. via
  // Regel-Engine oder Manual-Override im UI).
  if (input.requestedShippingMethod) {
    const forced = input.requestedShippingMethod;
    // Wir bestimmen trotzdem eine passende Nummer und pruefen Konsistenz.
    const candidate = pickForProduct(forced as any, input.credentials);
    if (candidate.ok) return candidate;
    return candidate;
  }

  const origin = normalizeCountry(input.originCountry) || 'DE';
  const dest = normalizeCountry(input.destinationCountry) || 'DE';

  // Fall B: Absender nicht DE — DHL Paket DE Versenden unterstuetzt
  // ausschliesslich Absender aus Deutschland. Frueh und klar ablehnen.
  if (origin !== 'DE') {
    return {
      ok: false,
      errorCode: 'DHL_INVALID_ORIGIN_COUNTRY',
      message:
        `Die DHL Paket DE Versenden API unterstuetzt mit dieser deutschen ` +
        `DHL-Konfiguration nur Sendungen mit Absenderland Deutschland. ` +
        `Absender ist aber "${origin}".`,
    };
  }

  // DE → DE: National-Nummer noetig
  if (dest === 'DE') {
    return pickForProduct('V01PAK', input.credentials);
  }

  // DE → Nicht-DE: internationale Nummer noetig.
  // Bevorzugung nach Verfahren, nicht nach Feld-Name:
  //   1. Wenn 54er-Nummer vorhanden UND EU-Ziel → V54EPAK (guenstiger)
  //   2. Sonst wenn 53er-Nummer vorhanden → V53WPAK (funktioniert fuer EU + Nicht-EU)
  //   3. Wenn nichts passt → klarer Fehler statt stiller Fallback
  const allIntlNumbers = collectAllBillingNumbers(input.credentials).filter(
    (n) => n.parsed.procedure !== '01',
  );
  const has54 = allIntlNumbers.find((n) => n.parsed.procedure === '54');
  const has53 = allIntlNumbers.find((n) => n.parsed.procedure === '53');

  if (EU_COUNTRIES.has(dest) && has54) {
    return ok('V54EPAK', has54.parsed, 'EU-Ziel und Europaket-Vertrag vorhanden');
  }
  if (has53) {
    return ok('V53WPAK', has53.parsed, 'International-Vertrag deckt EU + Nicht-EU ab');
  }
  if (has54) {
    // Nur 54er, aber Ziel nicht in EU → 54 ist nur fuer EU-Laender freigeschaltet
    return {
      ok: false,
      errorCode: 'DHL_PRODUCT_BILLING_MISMATCH',
      message:
        `Ziel "${dest}" ist ausserhalb der EU. Die konfigurierte Europaket-` +
        `Abrechnungsnummer (Verfahren 54) darf hierfuer nicht verwendet ` +
        `werden. Bitte eine Weltpaket-Nummer (Verfahren 53) hinterlegen.`,
    };
  }
  return {
    ok: false,
    errorCode: 'DHL_MISSING_INTERNATIONAL_BILLING_NUMBER',
    message:
      `Fuer Sendungen von Deutschland nach ${dest} ist keine passende ` +
      `internationale DHL-Abrechnungsnummer konfiguriert. Bitte im ` +
      `Integrations-Menue die Nummer fuer DHL Paket International ` +
      `(Verfahren 53) oder DHL Europaket (Verfahren 54) hinterlegen.`,
  };
}

function pickForProduct(
  product: 'V01PAK' | 'V53WPAK' | 'V54EPAK',
  creds: AvailableBillingNumbers,
): ResolveResult {
  const all = collectAllBillingNumbers(creds);
  const expectedProcedure = product === 'V01PAK' ? '01' : product === 'V54EPAK' ? '54' : '53';
  const match = all.find((n) => n.parsed.procedure === expectedProcedure);
  if (!match) {
    return {
      ok: false,
      errorCode:
        product === 'V01PAK'
          ? 'DHL_MISSING_NATIONAL_BILLING_NUMBER'
          : 'DHL_MISSING_INTERNATIONAL_BILLING_NUMBER',
      message: `Keine DHL-Abrechnungsnummer mit Verfahren ${expectedProcedure} hinterlegt (fuer Produkt ${product}).`,
    };
  }
  return ok(product, match.parsed, `Verfahren ${expectedProcedure} passt zu ${product}`);
}

function ok(
  product: 'V01PAK' | 'V53WPAK' | 'V54EPAK',
  parsed: ParsedBillingNumber,
  reason: string,
): ResolveResult {
  return {
    ok: true,
    product,
    billingNumber: parsed.raw,
    procedure: parsed.procedure,
    masked: parsed.masked,
    reason,
  };
}

/**
 * Sammelt alle vorhandenen Nummern aus den drei Legacy-Feldern und parst
 * sie. Ungueltige Nummern werden verworfen (aber im Log erwaehnt).
 * Damit wird die Auto-Migration implizit: eine Nummer im "Europaket"-Feld
 * die eigentlich Verfahren 53 hat, wird korrekt als International erkannt.
 */
function collectAllBillingNumbers(
  creds: AvailableBillingNumbers,
): Array<{ sourceField: string; parsed: ParsedBillingNumber }> {
  const out: Array<{ sourceField: string; parsed: ParsedBillingNumber }> = [];
  const candidates: Array<{ field: keyof AvailableBillingNumbers; value: string | null | undefined }> = [
    { field: 'billingNumber', value: creds.billingNumber },
    { field: 'billingNumberEu', value: creds.billingNumberEu },
    { field: 'billingNumberIntl', value: creds.billingNumberIntl },
  ];
  const seen = new Set<string>();
  for (const c of candidates) {
    if (!c.value) continue;
    const parsed = parseBillingNumber(c.value);
    if ('kind' in parsed) continue;
    if (seen.has(parsed.raw)) continue;
    seen.add(parsed.raw);
    out.push({ sourceField: c.field as string, parsed });
  }
  return out;
}

function normalizeCountry(input: string | null | undefined): string {
  if (!input) return '';
  const s = String(input).trim().toUpperCase();
  // "Austria" → "AT", "Deutschland" → "DE" etc. (haeufige Namen zur ISO-Absicherung)
  const names: Record<string, string> = {
    DEUTSCHLAND: 'DE', GERMANY: 'DE',
    OESTERREICH: 'AT', 'ÖSTERREICH': 'AT', AUSTRIA: 'AT',
    SCHWEIZ: 'CH', SWITZERLAND: 'CH',
    FRANKREICH: 'FR', FRANCE: 'FR',
    NIEDERLANDE: 'NL', NETHERLANDS: 'NL',
    ITALIEN: 'IT', ITALY: 'IT',
    SPANIEN: 'ES', SPAIN: 'ES',
  };
  if (names[s]) return names[s];
  // Alpha-3 → Alpha-2 (nur die haeufigsten)
  const alpha3: Record<string, string> = {
    DEU: 'DE', AUT: 'AT', CHE: 'CH', FRA: 'FR', BEL: 'BE', NLD: 'NL',
    LUX: 'LU', ITA: 'IT', ESP: 'ES', PRT: 'PT', GBR: 'GB', IRL: 'IE',
    DNK: 'DK', SWE: 'SE', FIN: 'FI', POL: 'PL', CZE: 'CZ', SVK: 'SK',
    HUN: 'HU', SVN: 'SI', HRV: 'HR', ROU: 'RO', BGR: 'BG', GRC: 'GR',
  };
  if (alpha3[s]) return alpha3[s];
  return s.slice(0, 2);
}
