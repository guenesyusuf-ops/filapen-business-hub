import { describe, it, expect } from 'vitest';
import { margin, roas, marginTone, costRatio } from '../domain/margin';

describe('margin', () => {
  it('rechnet korrekt: 300 profit / 1000 netto = 30%', () => {
    expect(margin(300, 1000)?.toString()).toBe('30');
  });

  it('behandelt Nachkommastellen: 248.75 / 1000 = 24.88%', () => {
    expect(margin('248.75', 1000)?.toString()).toBe('24.88');
  });

  it('gibt NULL bei Netto=0 (nicht 0, nicht Infinity)', () => {
    expect(margin(500, 0)).toBeNull();
  });

  it('kann negativ sein (Verlust)', () => {
    expect(margin(-100, 1000)?.toString()).toBe('-10');
  });

  it('Profit=0 mit Netto>0 gibt 0%', () => {
    expect(margin(0, 1000)?.toString()).toBe('0');
  });
});

describe('roas', () => {
  it('rechnet korrekt: 5000 Umsatz / 1000 Ads = 5.00', () => {
    expect(roas(5000, 1000)?.toString()).toBe('5');
  });

  it('gibt NULL bei Ads=0', () => {
    expect(roas(1000, 0)).toBeNull();
  });

  it('Umsatz=0 mit Ads>0 gibt 0', () => {
    expect(roas(0, 100)?.toString()).toBe('0');
  });
});

describe('marginTone', () => {
  it('NULL wenn Marge nicht berechenbar', () => {
    expect(marginTone(null)).toBeNull();
  });

  it('unter 20 % = critical', () => {
    expect(marginTone(margin(190, 1000))).toBe('critical');    // 19%
    expect(marginTone(margin(0, 1000))).toBe('critical');      // 0%
    expect(marginTone(margin(-100, 1000))).toBe('critical');   // -10%
  });

  it('20 bis unter 25 % = warn', () => {
    expect(marginTone(margin(200, 1000))).toBe('warn');    // 20%
    expect(marginTone(margin(245, 1000))).toBe('warn');    // 24.5%
  });

  it('25 bis unter 30 % = good', () => {
    expect(marginTone(margin(250, 1000))).toBe('good');    // 25%
    expect(marginTone(margin(299, 1000))).toBe('good');    // 29.9%
  });

  it('ab 30 % = target', () => {
    expect(marginTone(margin(300, 1000))).toBe('target');
    expect(marginTone(margin(500, 1000))).toBe('target');
  });

  it('konfigurierbare Schwellen werden verwendet', () => {
    expect(marginTone(margin(150, 1000), 10, 12, 15)).toBe('target');    // 15% mit target=15
    expect(marginTone(margin(100, 1000), 15, 20, 25)).toBe('critical');  // 10% mit critical=15
  });
});

describe('costRatio', () => {
  it('rechnet Anteil korrekt: 240 Kosten / 1000 Umsatz = 24%', () => {
    expect(costRatio(240, 1000)?.toString()).toBe('24');
  });

  it('NULL bei Nettoumsatz=0', () => {
    expect(costRatio(100, 0)).toBeNull();
  });
});

describe('margin/costRatio — negativer Nenner', () => {
  it('gibt NULL statt einer positiven Marge bei negativem Netto-Umsatz', () => {
    // Frueher: -50 / -100 * 100 = +50 -> ein Verlust-Kanal erschien als
    // bester Kanal des Monats und marginTone() stufte ihn auf 'target'.
    expect(margin(-50, -100)).toBeNull();
    expect(margin(300, -1000)).toBeNull();
  });

  it('gibt NULL bei negativem Netto-Umsatz auch fuer costRatio', () => {
    expect(costRatio(50, -100)).toBeNull();
  });

  it('marginTone auf NULL bleibt NULL — kein falsches Gruen', () => {
    expect(marginTone(margin(-50, -100))).toBeNull();
  });

  it('positiver Nenner rechnet unveraendert weiter', () => {
    expect(margin(-50, 100)?.toString()).toBe('-50');
    expect(costRatio(30, 100)?.toString()).toBe('30');
  });
});
