import { Injectable, BadRequestException } from '@nestjs/common';
import { DailyDataService, Channel } from './daily-data.service';

/**
 * CSV/XLSX-Import fuer Tages-Umsatz + Werbekosten + Versand.
 *
 * Ablauf: 2-Schritt.
 *   1. POST /import/preview mit CSV/XLSX-Text -> Parser gibt Zeilen + Fehler
 *   2. POST /import/confirm mit den akzeptierten Zeilen -> tatsaechlich schreiben
 *
 * Format-Erwartung (Header-Zeile in beliebiger Reihenfolge):
 *   Datum, Kanal, Brutto19, Brutto7, Retouren19, Retouren7,
 *   Meta, Google, Influencer, AmazonPPC, TikTokAds,
 *   ShopifyPakete, TikTokPakete
 *
 * Datumsformat: DD.MM.YYYY oder YYYY-MM-DD. Kanal: shopify|amazon|tiktok.
 * Zahlen: deutsches Format (1.234,56) oder ISO (1234.56).
 */

export interface ImportPreviewRow {
  rowIndex: number;
  date: string;                     // YYYY-MM-DD nach Normalisierung
  channel?: Channel;                // NULL wenn nur Ads/Shipping (fuer alle Kanaele)
  raw: Record<string, string>;      // Original-Werte fuer UI
  parsed: {
    gross19?: string; gross7?: string;
    returns19?: string; returns7?: string;
    meta?: string; google?: string; influencer?: string;
    amazonPpc?: string; tiktokAds?: string;
    shopifyPackages?: number; tiktokPackages?: number;
  };
  errors: string[];                 // pro-Zeile Fehler
}

export interface ImportPreviewResult {
  rows: ImportPreviewRow[];
  totalRows: number;
  errorCount: number;
  warnings: string[];               // gesamte Preview-Warnungen
}

@Injectable()
export class ImportService {
  constructor(private readonly daily: DailyDataService) {}

  /** Parst CSV-Text -> Preview-Struktur. Kein DB-Schreiben. */
  preview(csvText: string): ImportPreviewResult {
    if (!csvText?.trim()) throw new BadRequestException('CSV-Inhalt ist leer');
    // BOM entfernen
    csvText = csvText.replace(/^﻿/, '');
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) throw new BadRequestException('CSV benoetigt mindestens Header + eine Zeile');

    const separator = this.detectSeparator(lines[0]);
    const header = this.parseLine(lines[0], separator).map((h) => this.normalizeHeader(h));
    const requiredCols = ['datum'];
    for (const req of requiredCols) {
      if (!header.includes(req)) {
        throw new BadRequestException(`Pflichtspalte "${req}" fehlt im Header. Gefunden: ${header.join(', ')}`);
      }
    }

    const rows: ImportPreviewRow[] = [];
    let errorCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const fields = this.parseLine(lines[i], separator);
      const raw: Record<string, string> = {};
      header.forEach((h, idx) => { raw[h] = (fields[idx] ?? '').trim(); });
      const errors: string[] = [];

      // Datum parsen
      const dateStr = raw['datum'];
      const isoDate = this.parseDate(dateStr);
      if (!isoDate) errors.push(`Datum ungueltig: "${dateStr}" (erwartet DD.MM.YYYY oder YYYY-MM-DD)`);

      // Kanal (optional)
      let channel: Channel | undefined;
      const chRaw = (raw['kanal'] ?? '').toLowerCase();
      if (chRaw) {
        if (!['shopify', 'amazon', 'tiktok'].includes(chRaw)) {
          errors.push(`Kanal ungueltig: "${chRaw}" (erwartet shopify|amazon|tiktok)`);
        } else {
          channel = chRaw as Channel;
        }
      }

      const parsed: ImportPreviewRow['parsed'] = {};
      /**
       * Eine gefuellte, aber nicht lesbare Zelle MUSS ein Zeilenfehler werden.
       * Vorher wurde sie still zu undefined: die Zeile galt als in Ordnung,
       * der Wert wurde nie geschrieben, und confirm() zaehlte sie trotzdem als
       * "geschrieben". Der Nutzer las "12 Zeilen geschrieben, 0 uebersprungen"
       * und hielt den Monat fuer importiert.
       */
      const decField = (col: string, label: string): string | undefined => {
        const rohwert = raw[col];
        if (!rohwert || !rohwert.trim()) return undefined;
        const wert = this.parseDecimal(rohwert);
        if (wert === null) {
          errors.push(`${label}: Betrag nicht lesbar ("${rohwert.trim()}")`);
          return undefined;
        }
        return wert;
      };
      parsed.gross19    = decField('brutto19', 'brutto19');
      parsed.gross7     = decField('brutto7', 'brutto7');
      parsed.returns19  = decField('retouren19', 'retouren19');
      parsed.returns7   = decField('retouren7', 'retouren7');
      parsed.meta       = decField('meta', 'meta');
      parsed.google     = decField('google', 'google');
      parsed.influencer = decField('influencer', 'influencer');
      parsed.amazonPpc  = decField('amazonppc', 'amazonppc');
      parsed.tiktokAds  = decField('tiktokads', 'tiktokads');
      if (raw['shopifypakete']) {
        const n = parseInt(raw['shopifypakete'], 10);
        if (Number.isNaN(n) || n < 0) errors.push('shopifypakete muss positive Ganzzahl sein');
        else parsed.shopifyPackages = n;
      }
      if (raw['tiktokpakete']) {
        const n = parseInt(raw['tiktokpakete'], 10);
        if (Number.isNaN(n) || n < 0) errors.push('tiktokpakete muss positive Ganzzahl sein');
        else parsed.tiktokPackages = n;
      }

      // Sanity-Check: wenn Umsatz-Felder angegeben, dann muss channel gesetzt sein
      const hasSalesFields = parsed.gross19 || parsed.gross7 || parsed.returns19 || parsed.returns7;
      if (hasSalesFields && !channel) {
        errors.push('Umsatz-Felder erfordern Kanal-Spalte');
      }

      if (errors.length > 0) errorCount++;
      rows.push({
        rowIndex: i,
        date: isoDate ?? '',
        channel,
        raw,
        parsed,
        errors,
      });
    }

    const warnings: string[] = [];
    // Duplikat-Erkennung (gleicher date+channel)
    const seen = new Set<string>();
    for (const r of rows) {
      if (r.channel && r.date) {
        const key = `${r.date}|${r.channel}`;
        if (seen.has(key)) warnings.push(`Zeile ${r.rowIndex}: Duplikat fuer ${r.date} / ${r.channel} — spaeterer Eintrag wird gewinnen`);
        seen.add(key);
      }
    }

    return {
      rows,
      totalRows: rows.length,
      errorCount,
      warnings,
    };
  }

  /**
   * Confirmed Import: nur akzeptierte Zeilen schreiben.
   * Fehlerhafte Zeilen werden uebersprungen (Client hat sie im Preview gesehen).
   */
  async confirm(orgId: string, role: string, previewRows: ImportPreviewRow[]): Promise<{
    written: number; skipped: number; failures: Array<{ date: string | null; reason: string }>;
  }> {
    if (!Array.isArray(previewRows)) throw new BadRequestException('rows fehlt');
    let written = 0, skipped = 0;
    // Warum eine Zeile nicht geschrieben wurde, war bisher nicht erkennbar:
    // catch {} schluckte jede Ursache, auch einen gesperrten Monat.
    const failures: Array<{ date: string | null; reason: string }> = [];
    for (const r of previewRows) {
      if (r.errors.length > 0 || !r.date) {
        skipped++;
        failures.push({ date: r.date ?? null, reason: r.errors[0] ?? 'Kein gueltiges Datum' });
        continue;
      }
      try {
        if (r.channel && (r.parsed.gross19 || r.parsed.gross7 || r.parsed.returns19 || r.parsed.returns7)) {
          await this.daily.upsertChannelSales(orgId, role, r.date, r.channel, {
            gross19: r.parsed.gross19,
            gross7: r.parsed.gross7,
            returns19: r.parsed.returns19,
            returns7: r.parsed.returns7,
          });
        }
        const hasAds = r.parsed.meta || r.parsed.google || r.parsed.influencer || r.parsed.amazonPpc || r.parsed.tiktokAds;
        if (hasAds) {
          await this.daily.upsertAds(orgId, role, r.date, {
            meta: r.parsed.meta, google: r.parsed.google, influencer: r.parsed.influencer,
            amazonPpc: r.parsed.amazonPpc, tiktokAds: r.parsed.tiktokAds,
          });
        }
        if (r.parsed.shopifyPackages !== undefined || r.parsed.tiktokPackages !== undefined) {
          await this.daily.upsertShipping(orgId, role, r.date, {
            shopifyPackages: r.parsed.shopifyPackages,
            tiktokPackages: r.parsed.tiktokPackages,
          });
        }
        written++;
      } catch (e: any) {
        skipped++;
        failures.push({ date: r.date, reason: e?.message ?? 'Unbekannter Fehler' });
      }
    }
    return { written, skipped, failures };
  }

  // ---------------------------------------------------------------------------
  // Parser-Helpers
  // ---------------------------------------------------------------------------

  private detectSeparator(headerLine: string): string {
    if ((headerLine.match(/;/g)?.length ?? 0) > (headerLine.match(/,/g)?.length ?? 0)) return ';';
    return ',';
  }

  private parseLine(line: string, sep: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        result.push(current);
        current = '';
      } else current += ch;
    }
    result.push(current);
    return result;
  }

  private normalizeHeader(h: string): string {
    return h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private parseDate(input: string): string | null {
    if (!input) return null;
    const s = input.trim();
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    // DD.MM.YYYY
    const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    return null;
  }

  /**
   * Zahlenformat aus einer Importdatei normalisieren.
   *
   * Der alte Code prüfte nur auf ein Komma mit 1-2 Nachkommastellen und liess
   * alles andere unveraendert durch. Ein deutscher Betrag OHNE Nachkommastelle
   * fiel damit in den else-Zweig: "12.500" (= 12.500 EUR) wurde zu 12,50 EUR,
   * "1.000" zu 1,00 EUR — Faktor 1.000 zu klein, ohne Fehler, ohne Warnung.
   * Ein Monatsimport mit runden Tagesumsaetzen landete so verfaelscht in der
   * DB und verdarb danach jede Marge, jeden ROAS und jeden Export.
   *
   * Jetzt werden Tausendergruppen erkannt:
   *   "1.234,56" -> 1234.56   (deutsch, Punkt = Tausender)
   *   "1,234.56" -> 1234.56   (englisch, Komma = Tausender)
   *   "1234,56"  -> 1234.56
   *   "12.500"   -> 12500     (deutsche Tausendergruppe)
   *   "1234.56"  -> 1234.56   (Dezimalpunkt, keine Tausendergruppe)
   */
  private parseDecimal(input: string | undefined): string | null {
    return parseImportDecimal(input);
  }
}

/**
 * Zahlenformat aus einer Importdatei normalisieren. Gibt null zurueck, wenn
 * der Wert nicht eindeutig lesbar ist — der Aufrufer MUSS das als Zeilenfehler
 * melden statt den Wert still zu verwerfen.
 *
 * Der alte Code prueft nur auf ein Komma mit 1-2 Nachkommastellen und liess
 * alles andere unveraendert durch. Ein deutscher Betrag OHNE Nachkommastelle
 * fiel damit in den else-Zweig: "12.500" (= 12.500 EUR) wurde zu 12,50 EUR,
 * "1.000" zu 1,00 EUR — Faktor 1.000 zu klein, ohne Fehler, ohne Warnung.
 * Ein Monatsimport mit runden Tagesumsaetzen landete so verfaelscht in der DB
 * und verdarb danach jede Marge, jeden ROAS und jeden Export.
 *
 *   "1.234,56" -> 1234.56   deutsch, Punkt = Tausender
 *   "1,234.56" -> 1234.56   englisch, Komma = Tausender
 *   "1234,56"  -> 1234.56
 *   "12.500"   -> 12500     deutsche Tausendergruppe
 *   "1234.56"  -> 1234.56   Dezimalpunkt, keine Tausendergruppe
 */
export function parseImportDecimal(input: string | undefined): string | null {
  if (!input) return null;
  const s = input.trim().replace(/\s/g, '');
  if (!s) return null;

  const hatKomma = s.includes(',');
  const hatPunkt = s.includes('.');
  let norm: string;

  if (hatKomma && hatPunkt) {
    // Das zuletzt stehende Trennzeichen ist der Dezimaltrenner.
    norm = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')   // deutsch
      : s.replace(/,/g, '');                      // englisch
  } else if (hatKomma) {
    norm = s.replace(',', '.');
  } else if (hatPunkt) {
    // Nur Punkte: saubere Tausendergruppen sind deutsch, alles andere ist
    // ein Dezimalpunkt.
    norm = /^-?\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, '') : s;
  } else {
    norm = s;
  }

  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null;
  return norm;
}
