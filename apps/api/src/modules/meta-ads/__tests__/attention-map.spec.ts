import { describe, expect, it } from 'vitest';
import { buildAttentionSegments, attentionSignal, AttentionPoint } from '../attention-map';

const pts = (arr: [string, number | null, number][]): AttentionPoint[] => arr.map(([label, seconds, viewers]) => ({ label, seconds, viewers }));

describe('attentionSignal (Drop-Schwellen, relativ zur Ad)', () => {
  it('klassifiziert korrekt', () => {
    expect(attentionSignal(5)).toBe('strong');
    expect(attentionSignal(15)).toBe('stable');
    expect(attentionSignal(30)).toBe('weak');
    expect(attentionSignal(45)).toBe('severe_drop');
    expect(attentionSignal(null)).toBe('stable');
  });
});

describe('buildAttentionSegments', () => {
  it('30s Video: normaler Verlauf mit Mid-Drop', () => {
    const { segments, maxViewers } = buildAttentionSegments(pts([
      ['0s', 0, 10000], ['3s', 3, 6000], ['25%', 7.5, 3000], ['50%', 15, 2400], ['75%', 22.5, 900], ['95%', 28.5, 700], ['100%', 30, 650],
    ]));
    expect(maxViewers).toBe(10000);
    expect(segments).toHaveLength(6);
    const mid = segments.find((s) => s.label === '50%→75%')!;
    expect(mid.retention).toBe(37.5); // 900/2400
    expect(mid.drop).toBe(62.5);
    expect(mid.signal).toBe('severe_drop');
    expect(segments[0].startSecond).toBe(0);
    expect(segments[0].endSecond).toBe(3);
    const hook = segments[0]; // 0s->3s: 6000/10000 = 60% retention, 40% drop
    expect(hook.drop).toBe(40);
    expect(hook.signal).toBe('severe_drop');
  });

  it('60s Video: Sekunden korrekt übernommen', () => {
    const { segments } = buildAttentionSegments(pts([['3s', 3, 5000], ['50%', 30, 2500], ['100%', 60, 1000]]));
    expect(segments[0].startSecond).toBe(3);
    expect(segments[0].endSecond).toBe(30);
    expect(segments[1].endSecond).toBe(60);
  });

  it('fehlende Video-Länge: Sekunden null, Segmente trotzdem da', () => {
    const { segments } = buildAttentionSegments(pts([['3s', null, 5000], ['25%', null, 3000], ['50%', null, 2000]]));
    expect(segments).toHaveLength(2);
    expect(segments[0].startSecond).toBeNull();
    expect(segments[0].retention).toBe(60);
  });

  it('fehlende Checkpoints: nur gültige Punkte werden verbunden', () => {
    const { segments } = buildAttentionSegments(pts([['3s', 3, 5000], ['50%', 15, 2000]]));
    expect(segments).toHaveLength(1);
    expect(segments[0].label).toBe('3s→50%');
  });

  it('zero viewers: keine Division durch 0, retention null', () => {
    const { segments, maxViewers } = buildAttentionSegments(pts([['3s', 3, 0], ['25%', 7.5, 0]]));
    expect(maxViewers).toBe(0);
    expect(segments[0].retention).toBeNull();
    expect(segments[0].normalizedAttention).toBe(0);
    expect(segments[0].signal).toBe('stable');
  });

  it('später Drop wird als severe_drop erkannt', () => {
    const { segments } = buildAttentionSegments(pts([['75%', 22, 1000], ['95%', 28, 500]]));
    expect(segments[0].signal).toBe('severe_drop'); // 50% drop
  });

  it('starke Haltephase = strong', () => {
    const { segments } = buildAttentionSegments(pts([['25%', 7, 1000], ['50%', 15, 970]]));
    expect(segments[0].signal).toBe('strong'); // 3% drop
  });

  it('< 2 gültige Punkte: keine Segmente', () => {
    expect(buildAttentionSegments(pts([['3s', 3, 5000]])).segments).toHaveLength(0);
  });
});
