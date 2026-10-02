import { describe, expect, it } from 'vitest';
import { parseRow } from '../import/import-logic';
import { computeSegments, SnapshotMetrics } from '../longterm-segments';
import { analyzeLongTerm, classifyLtHook, LtAd, impressionEvidence, conversionEvidence } from '../longterm-strategy';

// --------------------------------------------------------------------------- #52 Normalisierung
describe('#52 Hook/Hold als Bruch -> Prozent, CTR unverändert (reused parseRow, meta_longterm)', () => {
  const raw = { date: '2026-02-01', impressions: '1000', hookRate: '0.15042475', holdRate: '0.20955425', ctrAll: '1.087247', outboundCtr: '0.741305' };
  const p = parseRow('meta_longterm', raw);
  it('hook 0.15042475 -> 15.04 %', () => expect(p.values.hookRate).toBeCloseTo(15.04, 2));
  it('hold 0.20955425 -> 20.96 %', () => expect(p.values.holdRate).toBeCloseTo(20.96, 2));
  it('CTR 1.087247 bleibt ~1.087 % (NICHT ×100)', () => expect(p.values.ctrAll).toBeCloseTo(1.087, 2));
  it('Outbound CTR 0.741305 bleibt ~0.741 % (NICHT ×100)', () => expect(p.values.outboundCtr).toBeCloseTo(0.741, 2));
  it('erkennt Long-Term-Felder (Käufe, Meta ROAS)', () => {
    const q = parseRow('meta_longterm', { date: '2026-02-01', purchases: '320', metaRoas: '4.1', spend: '12.000,50' });
    expect(q.values.purchases).toBe(320);
    expect(q.values.metaRoas).toBeCloseTo(4.1, 2);
    expect(q.values.spend).toBeCloseTo(12000.5, 2);
  });
});

// --------------------------------------------------------------------------- #53 Segment-Berechnung
describe('#53 Segment-Metriken = end/start, nicht gemittelt', () => {
  const m: SnapshotMetrics = { impressions: 10000, views3s: 6000, views25: 3000, views50: 2400, views75: 900, views95: 700, views100: 650, videoLengthSeconds: 30 };
  const f = computeSegments(m);
  it('6 Segmente', () => expect(f.segments).toHaveLength(6));
  it('Opening 6000/10000 = 60 % Retention / 40 % Drop', () => {
    const o = f.segments.find((s) => s.key === 'opening')!;
    expect(o.retention).toBe(60); expect(o.drop).toBe(40); expect(o.startViewers).toBe(10000);
  });
  it('Mid B 50->75 = 900/2400 = 37.5 %', () => {
    const s = f.segments.find((x) => x.key === 'mid_b')!;
    expect(s.retention).toBe(37.5); expect(s.drop).toBe(62.5);
  });
  it('Sekunden aus Videolänge (25->50 => 7.5..15s)', () => {
    const s = f.segments.find((x) => x.key === 'mid_a')!;
    expect(s.startSecond).toBe(7.5); expect(s.endSecond).toBe(15);
  });
  it('Completion 25->100', () => expect(f.completion25to100).toBe(21.7)); // 650/3000
  it('ohne Checkpoints keine Segmente', () => expect(computeSegments({ impressions: 5000, views3s: null, views25: null, views50: null, views75: null, views95: null, views100: null, videoLengthSeconds: null }).segments).toHaveLength(0));
});

// --------------------------------------------------------------------------- helpers
function mkAd(over: Partial<LtAd> & { adId: string; name: string } & { m?: SnapshotMetrics }): LtAd {
  const m = over.m ?? { impressions: over.impressions ?? 20000, views3s: null, views25: null, views50: null, views75: null, views95: null, views100: null, videoLengthSeconds: 30 };
  const seg = computeSegments(m).segments;
  return {
    adId: over.adId, name: over.name, metaAdId: over.metaAdId ?? null, matchedAdId: over.matchedAdId ?? null,
    spend: over.spend ?? null, impressions: over.impressions ?? m.impressions, reach: null,
    purchases: over.purchases ?? null, websitePurchases: null, metaRoas: over.metaRoas ?? null,
    costPerPurchase: over.costPerPurchase ?? null, conversionValue: null,
    hookRatePct: over.hookRatePct ?? null, holdRatePct: null, outboundCtr: over.outboundCtr ?? null, ctrAll: null,
    avgWatchTime: null, videoLengthSeconds: m.videoLengthSeconds,
    segments: over.segments ?? seg,
  };
}
// Checkpoint-Helfer: Mid-A-Retention gezielt setzen (views25=5000 => confidence high).
const funnel = (opts: { impr: number; v3?: number; v25?: number; v50?: number; v75?: number; v95?: number; v100?: number }): SnapshotMetrics => ({
  impressions: opts.impr, views3s: opts.v3 ?? Math.round(opts.impr * 0.5), views25: opts.v25 ?? 5000, views50: opts.v50 ?? 3000,
  views75: opts.v75 ?? 2000, views95: opts.v95 ?? 1500, views100: opts.v100 ?? 1200, videoLengthSeconds: 30,
});

// --------------------------------------------------------------------------- #54 Confidence
describe('#54 Confidence / Sample Size', () => {
  it('hohe Hook-Rate bei winzigen Impressions ist kein Winner (promising)', () => {
    expect(classifyLtHook(35, 120)).toBe('promising');
    expect(impressionEvidence(120)).toBe('low');
  });
  it('moderate Hook bei vielen Impressions = iteration + hohe Evidenz', () => {
    expect(classifyLtHook(24, 60000)).toBe('iteration');
    expect(impressionEvidence(60000)).toBe('high');
  });
  it('viel Spend + 1 Kauf => kein Conversion-Winner / kein Control', () => {
    const s = analyzeLongTerm([mkAd({ adId: 'x', name: 'X', spend: 9000, impressions: 40000, purchases: 1, metaRoas: 0.2, hookRatePct: 20, m: funnel({ impr: 40000 }) })]);
    expect(s.conversionWinners).toHaveLength(0);
    expect(s.historicalControls).toHaveLength(0);
  });
  it('viele Käufe + schwacher Hook => Salvage-Kandidat', () => {
    const s = analyzeLongTerm([mkAd({ adId: 'b', name: 'AD-B', spend: 10000, impressions: 78000, purchases: 270, metaRoas: 4, hookRatePct: 16, m: funnel({ impr: 78000 }) })]);
    expect(s.salvageOpportunities.some((o) => o.adId === 'b')).toBe(true);
  });
  it('spätes Segment mit winziger Startpopulation ist kein Segment-Winner', () => {
    const tiny = mkAd({ adId: 't', name: 'Tiny', impressions: 40000, purchases: 5, hookRatePct: 20, m: funnel({ impr: 40000, v95: 50, v100: 45 }) }); // ending start=50 viewers
    const big = mkAd({ adId: 'g', name: 'Big', impressions: 40000, purchases: 5, hookRatePct: 20, m: funnel({ impr: 40000, v95: 1500, v100: 1000 }) });
    const s = analyzeLongTerm([tiny, big]);
    const endingWinner = s.segmentWinners.find((w) => w.segment === 'ending');
    expect(endingWinner?.adId).not.toBe('t'); // tiny population darf nicht gewinnen
  });
});

// --------------------------------------------------------------------------- #55 Recombination
describe('#55 Recombination', () => {
  it('A. Strong Hook A + Strong Conversion B => Base B, Opening-Source A', () => {
    const B = mkAd({ adId: 'B', name: 'AD-B', spend: 12000, impressions: 78000, purchases: 320, metaRoas: 4.1, hookRatePct: 16, m: funnel({ impr: 78000, v3: 12000 }) });
    const A = mkAd({ adId: 'A', name: 'AD-A', spend: 3000, impressions: 60000, purchases: 80, metaRoas: 2, hookRatePct: 35, m: funnel({ impr: 60000, v3: 30000 }) });
    const s = analyzeLongTerm([B, A]);
    const rec = s.recombinationCandidates.find((r) => r.recommendationType === 'REPLACE_OPENING' && r.baseAdId === 'B');
    expect(rec).toBeDefined();
    expect(rec!.sourceAdId).toBe('A');
    expect(rec!.priority).toBe('high');
    expect(rec!.keepSegments).not.toContain('opening');
  });

  it('B. Strong Control A + Strong Mid C => Base A, REPLACE_25_TO_50 Source C', () => {
    const A = mkAd({ adId: 'A', name: 'AD-A', spend: 12000, impressions: 60000, purchases: 300, metaRoas: 3.2, hookRatePct: 34, m: funnel({ impr: 60000, v25: 5000, v50: 1950 }) }); // mid_a 39%
    const C = mkAd({ adId: 'C', name: 'AD-C', spend: 2100, impressions: 15000, purchases: 58, metaRoas: 2.9, hookRatePct: 22, m: funnel({ impr: 15000, v25: 5000, v50: 3600 }) }); // mid_a 72%
    const s = analyzeLongTerm([A, C]);
    const rec = s.recombinationCandidates.find((r) => r.recommendationType === 'REPLACE_25_TO_50' && r.baseAdId === 'A');
    expect(rec).toBeDefined();
    expect(rec!.sourceAdId).toBe('C');
    expect(rec!.keepSegments).toContain('opening');
    expect(rec!.keepSegments).toContain('mid_b');
  });

  it('C. Late Drop A + Strong Late B => REPLACE_75_TO_95', () => {
    const A = mkAd({ adId: 'A', name: 'AD-A', spend: 9000, impressions: 50000, purchases: 120, metaRoas: 3, hookRatePct: 32, m: funnel({ impr: 50000, v75: 3000, v95: 600 }) }); // late 20%
    const B = mkAd({ adId: 'B', name: 'AD-B', spend: 9000, impressions: 50000, purchases: 120, metaRoas: 3, hookRatePct: 30, m: funnel({ impr: 50000, v75: 3000, v95: 2600 }) }); // late 87%
    const s = analyzeLongTerm([A, B]);
    expect(s.recombinationCandidates.some((r) => r.recommendationType === 'REPLACE_75_TO_95' && r.baseAdId === 'A' && r.sourceAdId === 'B')).toBe(true);
  });

  it('F. Low-Confidence-Source-Segment => kein starker Replace', () => {
    const A = mkAd({ adId: 'A', name: 'AD-A', spend: 12000, impressions: 60000, purchases: 300, metaRoas: 3, hookRatePct: 34, m: funnel({ impr: 60000, v25: 5000, v50: 1950 }) });
    const C = mkAd({ adId: 'C', name: 'AD-C', spend: 500, impressions: 4000, purchases: 2, metaRoas: 1, hookRatePct: 22, m: funnel({ impr: 4000, v25: 100, v50: 80 }) }); // mid_a start 100 => low conf
    const s = analyzeLongTerm([A, C]);
    expect(s.recombinationCandidates.some((r) => r.recommendationType === 'REPLACE_25_TO_50')).toBe(false);
  });

  it('G. nur eine brauchbare Ad => keine erfundene Cross-Ad-Empfehlung', () => {
    const A = mkAd({ adId: 'A', name: 'AD-A', spend: 12000, impressions: 60000, purchases: 300, metaRoas: 3, hookRatePct: 34, m: funnel({ impr: 60000 }) });
    const s = analyzeLongTerm([A]);
    expect(s.recombinationCandidates.some((r) => r.recommendationType.startsWith('REPLACE_'))).toBe(false);
  });
});

// --------------------------------------------------------------------------- #56 Evals
describe('#56 Long-Term Evals', () => {
  it('Low data => RETEST, keine aggressive Empfehlung', () => {
    const s = analyzeLongTerm([mkAd({ adId: 'z', name: 'Z', spend: 200, impressions: 1200, purchases: 2, hookRatePct: 25, m: funnel({ impr: 1200, v25: 200, v50: 150 }) })]);
    expect(s.recombinationCandidates.every((r) => !r.recommendationType.startsWith('REPLACE_'))).toBe(true);
    expect(s.recombinationCandidates.some((r) => r.recommendationType === 'RETEST_LOW_CONFIDENCE')).toBe(true);
  });
  it('Keine Video-Checkpoints => Conversion-Analyse möglich, aber kein Segment-Replace', () => {
    const noCp = mkAd({ adId: 'n', name: 'NoCP', spend: 11000, impressions: 60000, purchases: 250, metaRoas: 3.5, hookRatePct: 18, m: { impressions: 60000, views3s: null, views25: null, views50: null, views75: null, views95: null, views100: null, videoLengthSeconds: null } });
    const s = analyzeLongTerm([noCp]);
    expect(s.conversionWinners.some((c) => c.adId === 'n')).toBe(true);
    expect(s.historicalControls.some((c) => c.adId === 'n')).toBe(true);
    expect(s.recombinationCandidates.some((r) => r.recommendationType.startsWith('REPLACE_'))).toBe(false);
  });
  it('Strong Control + Strong Candidate-Segment => Control bleibt, nur ein Segment getauscht', () => {
    const A = mkAd({ adId: 'A', name: 'AD-A', spend: 12000, impressions: 60000, purchases: 300, metaRoas: 3.2, hookRatePct: 34, m: funnel({ impr: 60000, v25: 5000, v50: 1950 }) });
    const C = mkAd({ adId: 'C', name: 'AD-C', spend: 2100, impressions: 15000, purchases: 58, metaRoas: 2.9, hookRatePct: 22, m: funnel({ impr: 15000, v25: 5000, v50: 3600 }) });
    const s = analyzeLongTerm([A, C]);
    const rec = s.recombinationCandidates.find((r) => r.baseAdId === 'A' && r.recommendationType === 'REPLACE_25_TO_50')!;
    expect(rec.keepSegments.length).toBe(5); // genau ein Segment geändert
  });
});
