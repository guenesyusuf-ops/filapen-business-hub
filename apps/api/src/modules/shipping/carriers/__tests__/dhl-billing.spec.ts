import { describe, expect, it } from 'vitest';
import { parseBillingNumber, resolveDhlProduct } from '../dhl-billing';

// Hilfs-Nummern fuer Tests. Beliebige EKPs, nur Verfahren + Teilnahme relevant.
const NAT_01 = '2200000000' + '0101'; // Verfahren 01, Teilnahme 01
const INTL_53 = '2200000000' + '5301'; // Verfahren 53
const EUP_54 = '2200000000' + '5401'; // Verfahren 54

describe('parseBillingNumber', () => {
  it('parst 14-stellige Nummer korrekt', () => {
    const p = parseBillingNumber(NAT_01);
    expect(p).toEqual({
      raw: NAT_01,
      ekp: '2200000000',
      procedure: '01',
      participation: '01',
      masked: '**********0101',
    });
  });

  it('normalisiert Leerzeichen und Bindestriche', () => {
    const p = parseBillingNumber('2200 000 000 - 5301');
    if ('kind' in p) throw new Error('unexpected parse error');
    expect(p.procedure).toBe('53');
    expect(p.participation).toBe('01');
    expect(p.raw).toBe('2200000000' + '5301');
  });

  it('lehnt leere Eingabe ab', () => {
    expect(parseBillingNumber('')).toEqual({ kind: 'empty' });
    expect(parseBillingNumber(null)).toEqual({ kind: 'empty' });
    expect(parseBillingNumber(undefined)).toEqual({ kind: 'empty' });
  });

  it('lehnt falsche Laenge ab', () => {
    expect(parseBillingNumber('12345')).toEqual({ kind: 'invalid_length', length: 5 });
    expect(parseBillingNumber('1234567890123456')).toEqual({ kind: 'invalid_length', length: 16 });
  });

  it('lehnt ungueltige Zeichen ab', () => {
    expect(parseBillingNumber('220000000$5301')).toEqual({ kind: 'invalid_format' });
  });

  it('akzeptiert alphanumerische EKPs', () => {
    const p = parseBillingNumber('22ZZZZZZZZ5301');
    if ('kind' in p) throw new Error('unexpected');
    expect(p.procedure).toBe('53');
  });
});

describe('resolveDhlProduct — Kernszenarien', () => {
  it('Test 1: DE → DE waehlt V01PAK', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'DE',
      credentials: { billingNumber: NAT_01 },
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.product).toBe('V01PAK');
    expect(r.procedure).toBe('01');
  });

  it('Test 2: DE → AT mit 53er Nummer waehlt V53WPAK (nicht V54EPAK)', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'AT',
      credentials: { billingNumber: NAT_01, billingNumberEu: INTL_53 },
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.product).toBe('V53WPAK');
    expect(r.procedure).toBe('53');
    // Auto-Migration: Nummer im EU-Feld mit 53 wird korrekt als Intl erkannt.
  });

  it('Test 3: DE → AT mit expliziter 54er Nummer waehlt V54EPAK', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'AT',
      credentials: { billingNumber: NAT_01, billingNumberEu: EUP_54 },
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.product).toBe('V54EPAK');
    expect(r.procedure).toBe('54');
  });

  it('Test 4: DE → AT — wenn BEIDE (53 + 54) vorhanden, EU-Ziel bevorzugt V54EPAK', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'AT',
      credentials: {
        billingNumber: NAT_01,
        billingNumberEu: EUP_54,
        billingNumberIntl: INTL_53,
      },
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.product).toBe('V54EPAK');
  });

  it('Test 5: DE → CH (nicht EU) mit 53er Nummer waehlt V53WPAK', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'CH',
      credentials: { billingNumber: NAT_01, billingNumberIntl: INTL_53 },
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.product).toBe('V53WPAK');
  });

  it('Test 6: DE → CH — nur 54er Nummer vorhanden → Fehler (54 ist EU-only)', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'CH',
      credentials: { billingNumber: NAT_01, billingNumberEu: EUP_54 },
    });
    if (r.ok === true) throw new Error('expected mismatch error');
    expect(r.errorCode).toBe('DHL_PRODUCT_BILLING_MISMATCH');
  });

  it('Test 7: AT als Absender → Ablehnung mit DHL_INVALID_ORIGIN_COUNTRY', () => {
    const r = resolveDhlProduct({
      originCountry: 'AT',
      destinationCountry: 'DE',
      credentials: { billingNumber: NAT_01 },
    });
    if (r.ok === true) throw new Error('expected origin rejection');
    expect(r.errorCode).toBe('DHL_INVALID_ORIGIN_COUNTRY');
  });

  it('Test 8: DE → DE ohne National-Nummer → klarer Fehler', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'DE',
      credentials: {},
    });
    if (r.ok === true) throw new Error('expected missing-national error');
    expect(r.errorCode).toBe('DHL_MISSING_NATIONAL_BILLING_NUMBER');
  });

  it('Test 9: DE → AT ohne internationale Nummer → klarer Fehler', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'AT',
      credentials: { billingNumber: NAT_01 },
    });
    if (r.ok === true) throw new Error('expected missing-intl error');
    expect(r.errorCode).toBe('DHL_MISSING_INTERNATIONAL_BILLING_NUMBER');
  });

  it('Test 10: Shopify-Land "Austria" wird zu AT normalisiert', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'Austria',
      credentials: { billingNumber: NAT_01, billingNumberIntl: INTL_53 },
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.product).toBe('V53WPAK');
  });

  it('Test 11: Shopify-Land "AUT" (Alpha-3) wird zu AT normalisiert', () => {
    const r = resolveDhlProduct({
      originCountry: 'DEU',
      destinationCountry: 'AUT',
      credentials: { billingNumber: NAT_01, billingNumberIntl: INTL_53 },
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.product).toBe('V53WPAK');
  });

  it('Test 12: Nummer mit Leerzeichen wird als 53 erkannt (Auto-Migration)', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'AT',
      credentials: {
        billingNumber: NAT_01,
        billingNumberEu: '22 00 00 00 00 53 01', // User-formatiert
      },
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.product).toBe('V53WPAK');
    expect(r.procedure).toBe('53');
    expect(r.masked).toBe('**********5301');
  });

  it('Test 13: Explizite shippingMethod-Override respektiert', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'AT',
      credentials: { billingNumber: NAT_01, billingNumberIntl: INTL_53, billingNumberEu: EUP_54 },
      requestedShippingMethod: 'V53WPAK', // User zwingt Weltpaket obwohl 54 vorhanden
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.product).toBe('V53WPAK');
  });

  it('Test 14: Duplikate in verschiedenen Feldern werden entfernt', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'AT',
      credentials: {
        billingNumber: NAT_01,
        billingNumberEu: INTL_53,
        billingNumberIntl: INTL_53, // gleiche Nummer in beiden Feldern
      },
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.product).toBe('V53WPAK');
  });

  it('Test 15: masked-Ausgabe leakt keine EKP', () => {
    const r = resolveDhlProduct({
      originCountry: 'DE',
      destinationCountry: 'DE',
      credentials: { billingNumber: '1234567890' + '0101' },
    });
    if (r.ok === false) throw new Error(r.message);
    expect(r.masked).toBe('**********0101');
    expect(r.masked).not.toContain('1234567890');
  });
});
