import { describe, it, expect } from 'vitest';
import {
  safeDiv,
  cpaUnique,
  cpaTotal,
  calculatedRoas,
  watchPercentage,
  retention,
  dropOff,
  timePositionSeconds,
  weightedAverage,
  deriveRow,
  aggregate,
  buildRetentionSteps,
  biggestDrop,
  confidenceFrom,
  DailyMetricInput,
} from '../meta-ads-calc';

const empty: DailyMetricInput = {
  spend: null, impressions: null, hookRate: null, holdRate: null,
  videoViews3s: null, videoViews25: null, videoViews50: null, videoViews75: null,
  videoViews95: null, videoViews100: null, thruplays: null, averageWatchTimeSeconds: null,
  cpcAll: null, ctrAll: null, outboundCtr: null, totalSales: null, uniqueSales: null,
  hyrosRoas: null, revenue: null,
};
const row = (o: Partial<DailyMetricInput>): DailyMetricInput => ({ ...empty, ...o });

describe('safeDiv / Division durch 0', () => {
  it('teilt normal', () => expect(safeDiv(10, 2)).toBe(5));
  it('Nenner 0 → null', () => expect(safeDiv(10, 0)).toBeNull());
  it('Nenner negativ → null', () => expect(safeDiv(10, -1)).toBeNull());
  it('null-Eingaben → null', () => {
    expect(safeDiv(null, 2)).toBeNull();
    expect(safeDiv(10, null)).toBeNull();
  });
});

describe('CPA', () => {
  it('CPA Unique = Spend / Unique Sales', () => expect(cpaUnique(100, 4)).toBe(25));
  it('CPA Gesamt = Spend / Sales gesamt', () => expect(cpaTotal(100, 8)).toBe(12.5));
  it('0 Sales → null (kein Infinity)', () => {
    expect(cpaUnique(100, 0)).toBeNull();
    expect(cpaTotal(100, 0)).toBeNull();
  });
});

describe('Calculated ROAS (separat vom Hyros ROAS)', () => {
  it('= Umsatz / Spend', () => expect(calculatedRoas(420, 100)).toBe(4.2));
  it('Spend 0 → null', () => expect(calculatedRoas(420, 0)).toBeNull());
});

describe('Watch Percentage', () => {
  it('Ø Wiedergabedauer / Video-Länge × 100', () => expect(watchPercentage(20, 40)).toBe(50));
  it('keine Video-Länge → null', () => expect(watchPercentage(20, null)).toBeNull());
  it('Video-Länge 0 → null', () => expect(watchPercentage(20, 0)).toBeNull());
});

describe('Retention & Drop-Off', () => {
  it('Retention later/earlier × 100', () => expect(retention(7900, 10000)).toBe(79));
  it('Drop-Off (1 − later/earlier) × 100', () => expect(dropOff(7900, 10000)).toBe(21));
  it('earlier 0 → null', () => {
    expect(retention(10, 0)).toBeNull();
    expect(dropOff(10, 0)).toBeNull();
  });
});

describe('Zeitposition im Video', () => {
  it('40s-Video: 25/50/75/95/100%', () => {
    expect(timePositionSeconds(25, 40)).toBe(10);
    expect(timePositionSeconds(50, 40)).toBe(20);
    expect(timePositionSeconds(75, 40)).toBe(30);
    expect(timePositionSeconds(95, 40)).toBe(38);
    expect(timePositionSeconds(100, 40)).toBe(40);
  });
  it('keine Länge → null', () => expect(timePositionSeconds(50, null)).toBeNull());
});

describe('weightedAverage', () => {
  it('gewichtet nach Gewicht', () => {
    // (10*100 + 20*300) / (100+300) = 7000/400 = 17.5
    expect(weightedAverage([{ value: 10, weight: 100 }, { value: 20, weight: 300 }])).toBe(17.5);
  });
  it('ignoriert null-Werte und 0-Gewichte', () => {
    expect(weightedAverage([{ value: null, weight: 100 }, { value: 20, weight: 0 }, { value: 5, weight: 50 }])).toBe(5);
  });
  it('keine gültigen Paare → null', () => {
    expect(weightedAverage([{ value: null, weight: 10 }, { value: 3, weight: 0 }])).toBeNull();
  });
});

describe('deriveRow', () => {
  it('berechnet die Tageskennzahlen', () => {
    const d = deriveRow(
      row({ spend: 100, uniqueSales: 4, totalSales: 8, revenue: 420, averageWatchTimeSeconds: 20,
            videoViews25: 10000, videoViews50: 7900, videoViews75: 3100, videoViews95: 2600, videoViews100: 2500 }),
      40,
    );
    expect(d.cpaUnique).toBe(25);
    expect(d.cpaTotal).toBe(12.5);
    expect(d.calculatedRoas).toBe(4.2);
    expect(d.watchPercentage).toBe(50);
    expect(d.retention25to50).toBe(79);
    expect(d.drop50to75).toBeCloseTo(60.76, 1);
    expect(d.completion25to100).toBe(25);
  });
});

describe('aggregate (Zeitraum)', () => {
  const rows = [
    row({ spend: 50, impressions: 1000, uniqueSales: 2, totalSales: 4, revenue: 200, hyrosRoas: 4.0,
          hookRate: 20, ctrAll: 2, videoViews25: 5000, videoViews50: 4000, videoViews75: 1500, videoViews100: 1200 }),
    row({ spend: 50, impressions: 3000, uniqueSales: 2, totalSales: 4, revenue: 220, hyrosRoas: 4.4,
          hookRate: 30, ctrAll: 4, videoViews25: 5000, videoViews50: 3900, videoViews75: 1600, videoViews100: 1300 }),
  ];

  it('summiert additive Felder', () => {
    const a = aggregate(rows);
    expect(a.spend).toBe(100);
    expect(a.impressions).toBe(4000);
    expect(a.uniqueSales).toBe(4);
    expect(a.revenue).toBe(420);
    expect(a.videoViews25).toBe(10000);
  });

  it('CPA aus Summen, nicht Tagesmittel', () => {
    const a = aggregate(rows);
    expect(a.cpaUnique).toBe(25); // 100/4, nicht (25+25)/2 zufällig gleich — prüfe calculatedRoas:
    expect(a.calculatedRoas).toBe(4.2); // 420/100 — NICHT (4.0+4.4)/2 = 4.2 zufällig; siehe nächster Test
  });

  it('Hyros ROAS wird NICHT gemittelt (null über Zeitraum)', () => {
    const a = aggregate(rows);
    expect(a.hyrosRoas).toBeNull();
  });

  it('Raten gewichtet nach Impressionen (nicht arithmetisch)', () => {
    const a = aggregate(rows);
    // (20*1000 + 30*3000)/4000 = 110000/4000 = 27.5  (arithmetisch wäre 25)
    expect(a.hookRate).toBe(27.5);
    // (2*1000 + 4*3000)/4000 = 14000/4000 = 3.5
    expect(a.ctrAll).toBe(3.5);
  });

  it('Retention aus summierten Views', () => {
    const a = aggregate(rows);
    expect(a.retention25to50).toBe(79); // 7900/10000
  });
});

describe('Retention-Analytics (deterministisch)', () => {
  const agg = aggregate([
    row({ impressions: 60000, uniqueSales: 20, videoViews25: 10000, videoViews50: 7900, videoViews75: 3100, videoViews95: 2600, videoViews100: 2500 }),
  ]);

  it('buildRetentionSteps: Viewer, Retention/Drop je Stufe, Zeitposition (40s-Video)', () => {
    const steps = buildRetentionSteps(agg, 40);
    expect(steps.map((s) => s.key)).toEqual(['25', '50', '75', '95', '100']);
    expect(steps[0].viewers).toBe(10000);
    expect(steps[0].retentionFromPrev).toBeNull();     // erste Stufe
    expect(steps[0].timeSeconds).toBe(10);             // 25% von 40s
    expect(steps[1].retentionFromPrev).toBe(79);       // 7900/10000
    expect(steps[1].dropFromPrev).toBe(21);
    expect(steps[1].timeSeconds).toBe(20);
    expect(steps[4].completionFrom25).toBe(25);        // 2500/10000
  });

  it('ohne Video-Länge keine Zeitposition', () => {
    const steps = buildRetentionSteps(agg, null);
    expect(steps[0].timeSeconds).toBeNull();
  });

  it('biggestDrop findet den stärksten Abschnitt (50–75) + Sekunden', () => {
    const b = biggestDrop(agg, 40)!;
    expect(b.segment).toBe('50–75 %');
    expect(b.fromSeconds).toBe(20);
    expect(b.toSeconds).toBe(30);
    expect(b.dropPct).toBeGreaterThan(50);
  });

  it('biggestDrop null, wenn keine Daten', () => {
    expect(biggestDrop(aggregate([]), 40)).toBeNull();
  });

  it('confidenceFrom: Schwellen deterministisch', () => {
    expect(confidenceFrom(aggregate([row({ impressions: 60000 }), row({ impressions: 1 }), row({ impressions: 1 }), row({ impressions: 1 }), row({ impressions: 1 }), row({ impressions: 1 }), row({ impressions: 1 })])).level).toBe('high');
    expect(confidenceFrom(aggregate([row({ impressions: 12000 })])).level).toBe('medium');
    expect(confidenceFrom(aggregate([row({ impressions: 500 })])).level).toBe('low');
  });
});
