import { describe, it, expect } from 'vitest';
import { parseImportNumber, parseDate, isBlank } from '../parse-values';
import { detectMapping, normalizeHeader } from '../alias-map';
import { parseRow } from '../import-logic';

describe('parseImportNumber — Locale', () => {
  it('deutsch 1.234,56 → 1234.56', () => expect(parseImportNumber('1.234,56')).toBe(1234.56));
  it('englisch 1,234.56 → 1234.56', () => expect(parseImportNumber('1,234.56')).toBe(1234.56));
  it('1234,56 → 1234.56', () => expect(parseImportNumber('1234,56')).toBe(1234.56));
  it('deutsche Tausendergruppe 12.500 → 12500', () => expect(parseImportNumber('12.500')).toBe(12500));
  it('Dezimalpunkt 1234.56 → 1234.56', () => expect(parseImportNumber('1234.56')).toBe(1234.56));
  it('Prozent "3,2 %" → 3.2', () => expect(parseImportNumber('3,2 %')).toBe(3.2));
  it('Währung "1.234,56 €" → 1234.56', () => expect(parseImportNumber('1.234,56 €')).toBe(1234.56));
  it('leer → null', () => { expect(parseImportNumber('')).toBeNull(); expect(parseImportNumber('  ')).toBeNull(); });
  it('unlesbar → null (kein stilles Verwerfen)', () => expect(parseImportNumber('abc')).toBeNull());
  it('echte 0 → 0 (nicht null)', () => expect(parseImportNumber('0')).toBe(0));
  // Long-Term-Export-Edgecases (additiv, dürfen bestehende Fälle nicht ändern)
  it('führende Null 0.184 → 0.184 (NICHT 184)', () => expect(parseImportNumber('0.184')).toBe(0.184));
  it('Tausendergruppe 12.500 bleibt 12500', () => expect(parseImportNumber('12.500')).toBe(12500));
  it('wissenschaftlich 3.26E-5 → 0.0000326', () => expect(parseImportNumber('3.26E-5')).toBeCloseTo(0.0000326, 10));
  it('HH:MM:SS 00:00:00 → 0', () => expect(parseImportNumber('00:00:00')).toBe(0));
  it('HH:MM:SS 00:01:30 → 90 Sekunden', () => expect(parseImportNumber('00:01:30')).toBe(90));
  it('HH:MM:SS 01:02:03 → 3723 Sekunden', () => expect(parseImportNumber('01:02:03')).toBe(3723));
});

describe('parseDate — Formate + Ambiguität', () => {
  it('YYYY-MM-DD', () => expect(parseDate('2026-09-30')).toEqual({ iso: '2026-09-30', ambiguous: false }));
  it('DD.MM.YYYY', () => expect(parseDate('30.09.2026')).toEqual({ iso: '2026-09-30', ambiguous: false }));
  it('DD/MM/YYYY eindeutig (Tag>12)', () => expect(parseDate('30/09/2026')).toEqual({ iso: '2026-09-30', ambiguous: false }));
  it('MM/DD/YYYY eindeutig (zweiter>12)', () => expect(parseDate('09/30/2026')).toEqual({ iso: '2026-09-30', ambiguous: false }));
  it('01/02/2026 mehrdeutig → ambiguous + europ. Default (DD/MM)', () => {
    expect(parseDate('01/02/2026')).toEqual({ iso: '2026-02-01', ambiguous: true });
  });
  it('prefer mdy erzwingt MM/DD', () => expect(parseDate('01/02/2026', 'mdy')).toEqual({ iso: '2026-01-02', ambiguous: false }));
  it('leer → null, nicht ambiguous', () => expect(parseDate('')).toEqual({ iso: null, ambiguous: false }));
  it('Müll → null', () => expect(parseDate('foo')).toEqual({ iso: null, ambiguous: false }));
});

describe('detectMapping — Auto-Mapping', () => {
  it('erkennt englische Meta-Header inkl. View-Stufen', () => {
    const { mapping, unmapped } = detectMapping(
      ['Ad ID', 'Ad name', 'Day', 'Amount spent (EUR)', 'Impressions', 'CTR (all)', 'Outbound CTR', 'Video plays at 50%'],
      'meta',
    );
    expect(mapping.metaAdId).toBe('Ad ID');
    expect(mapping.adName).toBe('Ad name');
    expect(mapping.date).toBe('Day');
    expect(mapping.spend).toBe('Amount spent (EUR)');
    expect(mapping.impressions).toBe('Impressions');
    expect(mapping.ctrAll).toBe('CTR (all)');
    expect(mapping.outboundCtr).toBe('Outbound CTR');
    expect(mapping.videoViews50).toBe('Video plays at 50%');
    expect(unmapped).toEqual([]);
  });
  it('erkennt deutsche Header', () => {
    const { mapping } = detectMapping(['Anzeigenname', 'Tag', 'Ausgegebener Betrag (EUR)', 'Impressionen'], 'meta');
    expect(mapping.adName).toBe('Anzeigenname');
    expect(mapping.date).toBe('Tag');
    expect(mapping.spend).toBe('Ausgegebener Betrag (EUR)');
    expect(mapping.impressions).toBe('Impressionen');
  });
  it('zusätzliche Spalten landen in unmapped, fehlende Felder = null', () => {
    const { mapping, unmapped } = detectMapping(['Ad ID', 'Day', 'Spend', 'Irgendwas Fremdes'], 'meta');
    expect(mapping.metaAdId).toBe('Ad ID');
    expect(mapping.impressions).toBeNull();
    expect(unmapped).toContain('Irgendwas Fremdes');
  });
  it('Hyros-Header', () => {
    const { mapping } = detectMapping(['Ad ID', 'Date', 'Sales', 'Unique Sales', 'ROAS', 'Revenue'], 'hyros');
    expect(mapping.totalSales).toBe('Sales');
    expect(mapping.uniqueSales).toBe('Unique Sales');
    expect(mapping.hyrosRoas).toBe('ROAS');
    expect(mapping.revenue).toBe('Revenue');
  });
  it('normalizeHeader', () => expect(normalizeHeader('Amount spent (EUR)')).toBe('amountspenteur'));
});

describe('parseRow — null vs 0, Validierung, Plausibilität', () => {
  it('leere Zelle wird NICHT übernommen; 0 schon', () => {
    const r = parseRow('meta', { date: '2026-09-30', spend: '', impressions: '0', metaAdId: 'A1' });
    expect(r.metaAdId).toBe('A1');
    expect(r.date).toBe('2026-09-30');
    expect('spend' in r.values).toBe(false); // leer → nicht anfassen
    expect(r.values.impressions).toBe(0);     // echte 0
  });
  it('negative Werte → Fehler', () => {
    const r = parseRow('meta', { date: '2026-09-30', spend: '-5' });
    expect(r.errors.some((e) => /negativ/.test(e))).toBe(true);
  });
  it('Rate > 100 → Fehler', () => {
    const r = parseRow('meta', { date: '2026-09-30', ctrAll: '150' });
    expect(r.errors.some((e) => /0 und 100/.test(e))).toBe(true);
  });
  it('unlesbare Zahl → Fehler (nicht still verwerfen)', () => {
    const r = parseRow('meta', { date: '2026-09-30', spend: 'abc' });
    expect(r.errors.some((e) => /nicht lesbar/.test(e))).toBe(true);
  });
  it('fehlendes Datum → Fehler', () => {
    const r = parseRow('meta', { spend: '10' });
    expect(r.errors).toContain('Datum fehlt');
  });
  it('Plausibilität: unique > total → Warnung, kein Fehler', () => {
    const r = parseRow('hyros', { date: '2026-09-30', totalSales: '3', uniqueSales: '5' });
    expect(r.errors).toEqual([]);
    expect(r.warnings.some((w) => /Unique Sales/.test(w))).toBe(true);
  });
  it('Plausibilität: 50%-Views > 25%-Views → Warnung', () => {
    const r = parseRow('meta', { date: '2026-09-30', videoViews25: '100', videoViews50: '200' });
    expect(r.warnings.some((w) => /videoViews50/.test(w))).toBe(true);
  });
  it('int wird gerundet', () => {
    const r = parseRow('meta', { date: '2026-09-30', impressions: '1234,0' });
    expect(r.values.impressions).toBe(1234);
  });
});

describe('isBlank', () => {
  it('erkennt leer', () => { expect(isBlank('')).toBe(true); expect(isBlank(null)).toBe(true); expect(isBlank(' ')).toBe(true); });
  it('0 ist nicht blank', () => expect(isBlank('0')).toBe(false));
});

describe('detectMapping — echter deutscher Meta-Export (robust + sicher)', () => {
  const headers = [
    'Kampagnen-ID', 'Name der Anzeige', 'Berichtsstart', 'Ausgegebener Betrag (EUR)', 'Impressionen',
    'Hook Rate', 'Hold Rate', '3-sekündige Videowiedergaben',
    'Videowiedergaben bis 25 %', 'Videowiedergaben bis 50 %', 'Videowiedergaben bis 75 %',
    'Videowiedergaben bis 95 %', 'Videowiedergaben bis 100 %', 'ThruPlays',
    'Durchschnittliche Videowiedergabedauer', 'CPC (alle) (EUR)', 'CTR (alle)', 'Ausgehende CTR (Klickrate)',
  ];
  const { mapping, unmapped } = detectMapping(headers, 'meta');

  it('WICHTIG: Kampagnen-ID wird NICHT als Meta Ad ID erkannt', () => {
    expect(mapping.metaAdId).toBeNull();
    expect(unmapped).toContain('Kampagnen-ID');
  });
  it('Identitätsfelder korrekt', () => {
    expect(mapping.adName).toBe('Name der Anzeige');
    expect(mapping.date).toBe('Berichtsstart');
  });
  it('alle bekannten Metriken automatisch erkannt', () => {
    expect(mapping.spend).toBe('Ausgegebener Betrag (EUR)');
    expect(mapping.impressions).toBe('Impressionen');
    expect(mapping.hookRate).toBe('Hook Rate');
    expect(mapping.holdRate).toBe('Hold Rate');
    expect(mapping.videoViews3s).toBe('3-sekündige Videowiedergaben');
    expect(mapping.videoViews25).toBe('Videowiedergaben bis 25 %');
    expect(mapping.videoViews50).toBe('Videowiedergaben bis 50 %');
    expect(mapping.videoViews75).toBe('Videowiedergaben bis 75 %');
    expect(mapping.videoViews95).toBe('Videowiedergaben bis 95 %');
    expect(mapping.videoViews100).toBe('Videowiedergaben bis 100 %');
    expect(mapping.thruplays).toBe('ThruPlays');
    expect(mapping.averageWatchTimeSeconds).toBe('Durchschnittliche Videowiedergabedauer');
    expect(mapping.cpcAll).toBe('CPC (alle) (EUR)');
    expect(mapping.ctrAll).toBe('CTR (alle)');
    expect(mapping.outboundCtr).toBe('Ausgehende CTR (Klickrate)');
  });
});

describe('detectMapping — Negativtests Identität', () => {
  it('Kampagnen-ID ist nie Ad ID', () => {
    expect(detectMapping(['Kampagnen-ID'], 'meta').mapping.metaAdId).toBeNull();
    expect(detectMapping(['Campaign ID'], 'meta').mapping.metaAdId).toBeNull();
  });
  it('Anzeigengruppen-ID ist nie Ad ID', () => {
    expect(detectMapping(['Anzeigengruppen-ID'], 'meta').mapping.metaAdId).toBeNull();
    expect(detectMapping(['Ad Set ID'], 'meta').mapping.metaAdId).toBeNull();
  });
  it('echte Anzeigen-ID wird erkannt', () => {
    expect(detectMapping(['Anzeigen-ID'], 'meta').mapping.metaAdId).toBe('Anzeigen-ID');
    expect(detectMapping(['Meta Ad ID'], 'meta').mapping.metaAdId).toBe('Meta Ad ID');
    expect(detectMapping(['Advertisement ID'], 'meta').mapping.metaAdId).toBe('Advertisement ID');
  });
});

describe('normalizeHeader — Toleranz %, Währung, Schreibvarianten', () => {
  it('% mit/ohne Leerzeichen identisch', () => {
    expect(normalizeHeader('Videowiedergaben bis 25 %')).toBe(normalizeHeader('Videowiedergaben bis 25%'));
  });
  it('CPC (alle) (EUR) und CPC (Alle) mappen beide auf cpcAll', () => {
    expect(detectMapping(['CPC (alle) (EUR)'], 'meta').mapping.cpcAll).toBe('CPC (alle) (EUR)');
    expect(detectMapping(['CPC (Alle)'], 'meta').mapping.cpcAll).toBe('CPC (Alle)');
  });
  it('Diakritika/Case toleriert (3-sekündige)', () => {
    expect(detectMapping(['3-SEKÜNDIGE VIDEOWIEDERGABEN'], 'meta').mapping.videoViews3s).toBe('3-SEKÜNDIGE VIDEOWIEDERGABEN');
  });
});

describe('parseRow — Hook/Hold als Prozent (Bruch-Normalisierung)', () => {
  it('Hook/Hold als Bruch (0.21) werden auf Prozent normalisiert', () => {
    const r = parseRow('meta', { date: '2026-09-30', hookRate: '0.2117', holdRate: '0.2' });
    expect(r.values.hookRate).toBe(21.17);
    expect(r.values.holdRate).toBe(20);
  });
  it('Hook/Hold bereits als Prozent (21) bleiben unverändert', () => {
    const r = parseRow('meta', { date: '2026-09-30', hookRate: '21', holdRate: '19.6' });
    expect(r.values.hookRate).toBe(21);
    expect(r.values.holdRate).toBe(19.6);
  });
  it('CTR/Ausgehende CTR werden NICHT normalisiert (echte kleine Prozente < 1)', () => {
    const r = parseRow('meta', { date: '2026-09-30', ctrAll: '1.67', outboundCtr: '0.8' });
    expect(r.values.ctrAll).toBe(1.67);
    expect(r.values.outboundCtr).toBe(0.8); // bleibt 0,8 % — nicht 80 %
  });
});
