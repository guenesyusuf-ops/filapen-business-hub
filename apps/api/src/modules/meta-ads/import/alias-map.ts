/**
 * Zentrales Alias-Mapping für den Meta-Ads-Import (rein, testbar).
 *
 * Bekannte Spaltenüberschriften (EN + DE) werden auf kanonische Felder
 * abgebildet. Bewusst HIER zentral, nicht in UI-Komponenten verteilt.
 * Das automatische Mapping ist nur ein Vorschlag — es bleibt im UI editierbar.
 *
 * Sicherheit: Identitätsfelder (Meta Ad ID, Ad Name, Datum) matchen NUR über
 * sichere Alias-Regeln — kein aggressives Fuzzy-Matching. Für die Ad-ID gibt es
 * zusätzlich eine Denylist, damit übergeordnete IDs (Kampagne, Anzeigengruppe)
 * NIEMALS fälschlich als Ad-ID erkannt werden. Lieber offen als falsch.
 */

export type ImportType = 'meta' | 'hyros' | 'meta_longterm';

/** Kanonische Feldtypen → steuern Parsing + Validierung. */
export type FieldKind = 'id' | 'name' | 'date' | 'int' | 'decimal' | 'rate';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  aliases: string[]; // normalisiert (siehe normalizeHeader)
  /** Normalisierte Teilstrings, die ein Mapping auf dieses Feld VERBIETEN. */
  deny?: string[];
}

/**
 * Header robust normalisieren:
 * - Unicode NFKD + Diakritika entfernen (ä→a, ü→u, ø→o …)
 * - lowercase
 * - nur a–z0–9 behalten (trim, Mehrfach-Leerzeichen, -_/ , Klammern, % fallen weg)
 * So werden "Videowiedergaben bis 25 %" und "…25%" identisch, ebenso "CPC (alle)".
 */
export function normalizeHeader(h: string): string {
  return (h ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Für Metriken: angehängte Währungs-/Einheiten-Tokens am Ende ignorieren. */
function stripCurrency(norm: string): string {
  return norm.replace(/(eur|usd|gbp|chf)$/,'');
}

/** Übergeordnete IDs, die niemals eine Ad-ID sein dürfen. */
const PARENT_ID_DENY = ['kampagn', 'campaign', 'anzeigengruppe', 'adset', 'adgroup', 'adsetid', 'accountid', 'kontonummer', 'werbekonto'];

const META_FIELDS: FieldDef[] = [
  {
    key: 'metaAdId', label: 'Meta Ad ID', kind: 'id',
    // nur echte Ad-/Anzeigen-IDs
    aliases: ['anzeigenid', 'adid', 'advertisementid', 'metaadid'],
    deny: PARENT_ID_DENY,
  },
  {
    key: 'adName', label: 'Ad Name', kind: 'name',
    aliases: ['namederanzeige', 'anzeigenname', 'adname', 'advertisementname', 'nameofthead'],
    deny: ['kampagn', 'anzeigengruppe', 'adset', 'adgroup'],
  },
  {
    key: 'date', label: 'Datum', kind: 'date',
    // Berichtsstart bevorzugt; Berichtsende ist bewusst KEIN Alias.
    aliases: ['berichtsstart', 'berichtsbeginn', 'berichtstag', 'datum', 'date', 'reportingstarts', 'reportingstart', 'day', 'tag'],
  },
  {
    key: 'spend', label: 'Spend', kind: 'decimal',
    aliases: ['ausgegebenerbetrag', 'betragausgegeben', 'spend', 'amountspent', 'betrag', 'ausgaben', 'kosten'],
  },
  { key: 'impressions', label: 'Impressionen', kind: 'int', aliases: ['impressionen', 'impressions'] },
  { key: 'hookRate', label: 'Hook Rate', kind: 'rate', aliases: ['hookrate'] },
  { key: 'holdRate', label: 'Hold Rate', kind: 'rate', aliases: ['holdrate'] },
  {
    key: 'videoViews3s', label: '3s Views', kind: 'int',
    aliases: ['3sekundigevideowiedergaben', '3sekundenvideowiedergaben', '3secondvideoplays', '3secondvideoviews', '3svideoviews', '3svideoplays', '3sviews'],
  },
  {
    key: 'videoViews25', label: '25% Views', kind: 'int',
    aliases: ['videowiedergabenbis25', 'videoplaysat25', '25videoviews', 'videoplays25', '25views'],
  },
  {
    key: 'videoViews50', label: '50% Views', kind: 'int',
    aliases: ['videowiedergabenbis50', 'videoplaysat50', '50videoviews', 'videoplays50', '50views'],
  },
  {
    key: 'videoViews75', label: '75% Views', kind: 'int',
    aliases: ['videowiedergabenbis75', 'videoplaysat75', '75videoviews', 'videoplays75', '75views'],
  },
  {
    key: 'videoViews95', label: '95% Views', kind: 'int',
    aliases: ['videowiedergabenbis95', 'videoplaysat95', '95videoviews', 'videoplays95', '95views'],
  },
  {
    key: 'videoViews100', label: '100% Views', kind: 'int',
    aliases: ['videowiedergabenbis100', 'videoplaysat100', '100videoviews', 'videoplays100', '100views'],
  },
  { key: 'thruplays', label: 'ThruPlays', kind: 'int', aliases: ['thruplays', 'thruplay'] },
  {
    key: 'averageWatchTimeSeconds', label: 'Ø Wiedergabe (s)', kind: 'decimal',
    aliases: ['durchschnittlichevideowiedergabedauer', 'durchschnittlichewiedergabedauer', 'averagevideoplaytime', 'averagewatchtime', 'videoaveragewatchtime', 'averagevideoplaytimeseconds', 'durchschnwiedergabedauer'],
  },
  { key: 'cpcAll', label: 'CPC (Alle)', kind: 'decimal', aliases: ['cpcalle', 'cpcall', 'costperclickall', 'kostenproklickalle', 'kostenproklick'] },
  { key: 'ctrAll', label: 'CTR (Alle)', kind: 'rate', aliases: ['ctralle', 'ctrall', 'clickthroughrateall', 'linkklickrate'] },
  { key: 'outboundCtr', label: 'Ausgehende CTR', kind: 'rate', aliases: ['ausgehendectrklickrate', 'ausgehendectr', 'outboundctr', 'outboundctrclickthroughrate', 'outboundctrall'] },
];

const HYROS_FIELDS: FieldDef[] = [
  { key: 'metaAdId', label: 'Meta Ad ID', kind: 'id', aliases: ['anzeigenid', 'adid', 'metaadid', 'adreference', 'adref'], deny: PARENT_ID_DENY },
  { key: 'adName', label: 'Ad Name', kind: 'name', aliases: ['adname', 'anzeigenname', 'sourcename', 'source'], deny: ['kampagn', 'anzeigengruppe', 'adset'] },
  { key: 'date', label: 'Datum', kind: 'date', aliases: ['date', 'day', 'tag', 'datum'] },
  { key: 'totalSales', label: 'Sales gesamt', kind: 'int', aliases: ['sales', 'totalsales', 'salesgesamt', 'ordersgesamt', 'orders', 'bestellungen'] },
  { key: 'uniqueSales', label: 'Unique Sales', kind: 'int', aliases: ['uniquesales', 'uniqueorders', 'eindeutigesales', 'uniquesalescount'] },
  { key: 'hyrosRoas', label: 'Hyros ROAS', kind: 'decimal', aliases: ['roas', 'hyrosroas', 'returnonadspend'] },
  { key: 'revenue', label: 'Umsatz', kind: 'decimal', aliases: ['revenue', 'umsatz', 'salesrevenue', 'totalrevenue', 'erloes'] },
];

/**
 * Long-Term Review: aggregierter Export (ein Row = eine Ad über Monate). Enthält
 * ALLE Meta-Tagesfelder PLUS Conversion-/Scale-Felder, die der Tages-Import nicht
 * braucht (Käufe, Website-Käufe, Meta ROAS, Reichweite, Conversion-Wert, CPA).
 * Reiner additiver Satz — der Tages-'meta'-Satz bleibt unverändert.
 */
const META_LONGTERM_FIELDS: FieldDef[] = [
  ...META_FIELDS,
  { key: 'reach', label: 'Reichweite', kind: 'int', aliases: ['reichweite', 'reach'] },
  { key: 'purchases', label: 'Käufe', kind: 'int', aliases: ['kaufe', 'kaeufe', 'purchases', 'kaufegesamt'] },
  { key: 'websitePurchases', label: 'Website-Käufe', kind: 'int', aliases: ['websitekaufe', 'websitekaeufe', 'websitepurchases'] },
  { key: 'metaRoas', label: 'Meta ROAS', kind: 'decimal', aliases: ['roasreturnonadspendfurkaufe', 'roasfurkaufe', 'kaufroas', 'purchaseroas', 'roasforpurchases', 'roas'] },
  { key: 'conversionValue', label: 'Conversion-Wert (Käufe)', kind: 'decimal', aliases: ['conversionwertfurkaufe', 'conversionwert', 'kaufwert', 'conversionvalue', 'purchaseconversionvalue'] },
  { key: 'costPerPurchase', label: 'Kosten pro Kauf', kind: 'decimal', aliases: ['kostenprokauf', 'costperpurchase', 'kostenprokaufeur'] },
  { key: 'results', label: 'Ergebnisse', kind: 'int', aliases: ['ergebnisse', 'results'] },
];

export function fieldsFor(type: ImportType): FieldDef[] {
  if (type === 'meta_longterm') return META_LONGTERM_FIELDS;
  return type === 'meta' ? META_FIELDS : HYROS_FIELDS;
}

export interface DetectedMapping {
  /** kanonischer Feld-Key -> Original-Header (oder null, wenn nicht erkannt). */
  mapping: Record<string, string | null>;
  /** Header, die keinem Feld zugeordnet wurden. */
  unmapped: string[];
}

/** Trifft der Header dieses Feld? (exakter Normalform-Match, Währung tolerant). */
function headerMatchesField(header: string, f: FieldDef): boolean {
  const norm = normalizeHeader(header);
  if (!norm) return false;
  if (f.deny && f.deny.some((d) => norm.includes(d))) return false; // Schutz: nie falsch zuordnen
  if (f.aliases.includes(norm)) return true;
  // Metriken (nicht Identitätsfelder): Währungs-/Einheiten-Suffix ignorieren.
  if (f.kind !== 'id' && f.kind !== 'name' && f.kind !== 'date') {
    const stripped = stripCurrency(norm);
    if (stripped !== norm && f.aliases.includes(stripped)) return true;
  }
  return false;
}

/**
 * Automatisches Mapping vorschlagen. Jeder Header wird normalisiert und gegen
 * die Alias-Listen geprüft. Erste eindeutige Zuordnung gewinnt. Kein Fuzzy.
 */
export function detectMapping(headers: string[], type: ImportType): DetectedMapping {
  const fields = fieldsFor(type);
  const mapping: Record<string, string | null> = {};
  for (const f of fields) mapping[f.key] = null;
  const used = new Set<string>();

  for (const f of fields) {
    for (const h of headers) {
      if (used.has(h)) continue;
      if (headerMatchesField(h, f)) {
        mapping[f.key] = h;
        used.add(h);
        break;
      }
    }
  }
  const unmapped = headers.filter((h) => !used.has(h));
  return { mapping, unmapped };
}
