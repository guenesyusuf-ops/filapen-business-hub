/**
 * Zentrales Alias-Mapping für den Meta-Ads-Import (rein, testbar).
 *
 * Bekannte Spaltenüberschriften (EN + DE) werden auf kanonische Felder
 * abgebildet. Bewusst HIER zentral, nicht in UI-Komponenten verteilt.
 * Das automatische Mapping ist nur ein Vorschlag — es bleibt im UI editierbar.
 */

export type ImportType = 'meta' | 'hyros';

/** Kanonische Feldtypen → steuern Parsing + Validierung. */
export type FieldKind = 'id' | 'name' | 'date' | 'int' | 'decimal' | 'rate';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  aliases: string[]; // normalisiert (lowercase, nur a-z0-9)
}

/** Header normalisieren: lowercase, nur a–z0–9. */
export function normalizeHeader(h: string): string {
  return (h ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const META_FIELDS: FieldDef[] = [
  { key: 'metaAdId', label: 'Meta Ad ID', kind: 'id', aliases: ['adid', 'metaadid', 'anzeigenid', 'adidmeta'] },
  { key: 'adName', label: 'Ad Name', kind: 'name', aliases: ['adname', 'anzeigenname', 'nameofthead', 'anzeige'] },
  { key: 'date', label: 'Datum', kind: 'date', aliases: ['day', 'date', 'tag', 'datum', 'reportingstarts', 'reportingstart', 'berichtsbeginn'] },
  { key: 'spend', label: 'Spend', kind: 'decimal', aliases: ['amountspent', 'amountspenteur', 'amountspentusd', 'spend', 'betrag', 'ausgegebenerbetrag', 'ausgegebenerbetrageur', 'kosten', 'ausgaben'] },
  { key: 'impressions', label: 'Impressionen', kind: 'int', aliases: ['impressions', 'impressionen'] },
  { key: 'hookRate', label: 'Hook Rate', kind: 'rate', aliases: ['hookrate', 'hook'] },
  { key: 'holdRate', label: 'Hold Rate', kind: 'rate', aliases: ['holdrate', 'hold'] },
  { key: 'videoViews3s', label: '3s Views', kind: 'int', aliases: ['3secondvideoplays', 'videoplays3s', '3secondvideoviews', '3sekundenvideoaufrufe', 'videoaufrufe3sek', '3svideoplays'] },
  { key: 'videoViews25', label: '25% Views', kind: 'int', aliases: ['videoplaysat25', 'videowatchesat25', 'videoaufrufebei25', '25videoplays', 'videoplays25'] },
  { key: 'videoViews50', label: '50% Views', kind: 'int', aliases: ['videoplaysat50', 'videowatchesat50', 'videoaufrufebei50', '50videoplays', 'videoplays50'] },
  { key: 'videoViews75', label: '75% Views', kind: 'int', aliases: ['videoplaysat75', 'videowatchesat75', 'videoaufrufebei75', '75videoplays', 'videoplays75'] },
  { key: 'videoViews95', label: '95% Views', kind: 'int', aliases: ['videoplaysat95', 'videowatchesat95', 'videoaufrufebei95', '95videoplays', 'videoplays95'] },
  { key: 'videoViews100', label: '100% Views', kind: 'int', aliases: ['videoplaysat100', 'videowatchesat100', 'videoaufrufebei100', '100videoplays', 'videoplays100'] },
  { key: 'thruplays', label: 'ThruPlays', kind: 'int', aliases: ['thruplays', 'thruplay'] },
  { key: 'averageWatchTimeSeconds', label: 'Ø Wiedergabedauer (s)', kind: 'decimal', aliases: ['averagevideoplaytime', 'averagewatchtime', 'avgwatchtime', 'durchschnittlichewiedergabedauer', 'durchschnwiedergabedauer', 'averagevideoplaytimeseconds'] },
  { key: 'cpcAll', label: 'CPC (Alle)', kind: 'decimal', aliases: ['cpcall', 'cpc', 'cpcalle', 'costperclickall', 'kostenproklick', 'kostenproklickalle'] },
  { key: 'ctrAll', label: 'CTR (Alle)', kind: 'rate', aliases: ['ctrall', 'ctr', 'ctralle', 'clickthroughrateall', 'linkklickrate'] },
  { key: 'outboundCtr', label: 'Ausgehende CTR', kind: 'rate', aliases: ['outboundctr', 'ausgehendectr', 'outboundctrall', 'outboundclickthroughrate'] },
];

const HYROS_FIELDS: FieldDef[] = [
  { key: 'metaAdId', label: 'Meta Ad ID', kind: 'id', aliases: ['adid', 'metaadid', 'adreference', 'adref', 'anzeigenid'] },
  { key: 'adName', label: 'Ad Name', kind: 'name', aliases: ['adname', 'ad', 'anzeigenname', 'source', 'sourcename'] },
  { key: 'date', label: 'Datum', kind: 'date', aliases: ['date', 'day', 'tag', 'datum'] },
  { key: 'totalSales', label: 'Sales gesamt', kind: 'int', aliases: ['sales', 'totalsales', 'salesgesamt', 'ordersgesamt', 'orders', 'bestellungen'] },
  { key: 'uniqueSales', label: 'Unique Sales', kind: 'int', aliases: ['uniquesales', 'uniqueorders', 'eindeutigesales', 'uniquesalescount'] },
  { key: 'hyrosRoas', label: 'Hyros ROAS', kind: 'decimal', aliases: ['roas', 'hyrosroas', 'returnonadspend'] },
  { key: 'revenue', label: 'Umsatz', kind: 'decimal', aliases: ['revenue', 'umsatz', 'sales$', 'salesrevenue', 'totalrevenue', 'erlös', 'erloes'] },
];

export function fieldsFor(type: ImportType): FieldDef[] {
  return type === 'meta' ? META_FIELDS : HYROS_FIELDS;
}

export interface DetectedMapping {
  /** kanonischer Feld-Key -> Original-Header (oder null, wenn nicht erkannt). */
  mapping: Record<string, string | null>;
  /** Header, die keinem Feld zugeordnet wurden. */
  unmapped: string[];
}

/**
 * Automatisches Mapping vorschlagen. Jeder Header wird normalisiert und gegen
 * die Alias-Listen geprüft (exakter Normalform-Match). Erste Zuordnung gewinnt.
 */
export function detectMapping(headers: string[], type: ImportType): DetectedMapping {
  const fields = fieldsFor(type);
  const mapping: Record<string, string | null> = {};
  for (const f of fields) mapping[f.key] = null;
  const used = new Set<string>();

  for (const f of fields) {
    for (const h of headers) {
      if (used.has(h)) continue;
      if (f.aliases.includes(normalizeHeader(h))) {
        mapping[f.key] = h;
        used.add(h);
        break;
      }
    }
  }
  const unmapped = headers.filter((h) => !used.has(h));
  return { mapping, unmapped };
}
