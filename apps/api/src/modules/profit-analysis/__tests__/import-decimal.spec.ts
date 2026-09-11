import { describe, it, expect } from 'vitest';
import { parseImportDecimal } from '../import.service';

describe('parseImportDecimal — deutsche Tausendertrennung', () => {
  it('liest deutsche Tausendergruppen ohne Nachkommastelle korrekt', () => {
    // Der Kern des Faktor-1000-Fehlers: "12.500" wurde als 12,50 gelesen.
    expect(parseImportDecimal('12.500')).toBe('12500');
    expect(parseImportDecimal('1.000')).toBe('1000');
    expect(parseImportDecimal('1.234.567')).toBe('1234567');
  });

  it('liest deutsches Format mit Nachkommastellen', () => {
    expect(parseImportDecimal('1.234,56')).toBe('1234.56');
    expect(parseImportDecimal('1234,56')).toBe('1234.56');
    expect(parseImportDecimal('0,99')).toBe('0.99');
  });

  it('liest englisches Format', () => {
    expect(parseImportDecimal('1,234.56')).toBe('1234.56');
    expect(parseImportDecimal('1234.56')).toBe('1234.56');
  });

  it('behandelt einen Dezimalpunkt ohne Tausendergruppe als Dezimaltrenner', () => {
    expect(parseImportDecimal('12.5')).toBe('12.5');
    expect(parseImportDecimal('1234.5')).toBe('1234.5');
  });

  it('gibt null statt eines stillen Fehlwerts zurueck', () => {
    expect(parseImportDecimal('abc')).toBeNull();
    expect(parseImportDecimal('12,34,56')).toBeNull();
    expect(parseImportDecimal('')).toBeNull();
    expect(parseImportDecimal(undefined)).toBeNull();
    expect(parseImportDecimal('1.2.3')).toBeNull();
  });

  it('ignoriert umgebende Leerzeichen', () => {
    expect(parseImportDecimal('  12.500  ')).toBe('12500');
  });
});
