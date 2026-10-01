import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaAdsService, AdInput } from './meta-ads.service';
import { ImportType, detectMapping, fieldsFor } from './import/alias-map';
import { parseRow, RowStatus } from './import/import-logic';

const NUMERIC_KEYS = [
  'spend', 'impressions', 'hookRate', 'holdRate', 'videoViews3s', 'videoViews25',
  'videoViews50', 'videoViews75', 'videoViews95', 'videoViews100', 'thruplays',
  'averageWatchTimeSeconds', 'cpcAll', 'ctrAll', 'outboundCtr', 'totalSales',
  'uniqueSales', 'hyrosRoas', 'revenue',
] as const;
const RATE_KEYS = new Set(['hookRate', 'holdRate', 'ctrAll', 'outboundCtr']);

export interface AnalyzePreviewRow {
  rowIndex: number;
  metaAdId: string | null;
  adName: string | null;
  date: string | null;
  dateAmbiguous: boolean;
  values: Record<string, number>;
  matchedAdId: string | null;
  matchedAdName: string | null;
  matchedBy: 'id' | 'name' | null;
  status: RowStatus;
  errors: string[];
  warnings: string[];
}

export interface CommitRow {
  date: string;
  values: Record<string, number>;
  action: 'insert' | 'update' | 'skip';
  adId?: string | null;
  createAd?: AdInput | null;
}

@Injectable()
export class MetaAdsImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: MetaAdsService,
  ) {}

  // =========================================================================
  // ANALYZE — parsen, mappen, matchen, validieren (KEINE DB-Writes)
  // =========================================================================

  async analyze(
    orgId: string,
    type: ImportType,
    file: { buffer: Buffer; originalname: string } | undefined,
    mappingOverride?: Record<string, string | null>,
    prefer?: 'dmy' | 'mdy',
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('Keine Datei empfangen');
    const { headers, rows } = await this.parseFile(file.buffer, file.originalname);
    if (!headers.length) throw new BadRequestException('Datei enthält keine Kopfzeile');

    const detected = detectMapping(headers, type);
    const mapping = mappingOverride ?? detected.mapping;
    const headerIndex = new Map(headers.map((h, i) => [h, i] as const));

    // Ads der Org laden (Matching-Quellen).
    const ads = await this.prisma.maAd.findMany({
      where: { orgId },
      select: { id: true, metaAdId: true, name: true },
    });
    const byMetaId = new Map<string, string>();
    const byName = new Map<string, { id: string; count: number }>();
    for (const a of ads) {
      if (a.metaAdId) byMetaId.set(a.metaAdId.trim(), a.id);
      const key = a.name.trim().toLowerCase();
      const ex = byName.get(key);
      byName.set(key, ex ? { id: ex.id, count: ex.count + 1 } : { id: a.id, count: 1 });
    }

    const preview: AnalyzePreviewRow[] = [];
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i];
      const raw: Record<string, string | undefined> = {};
      for (const f of fieldsFor(type)) {
        const header = mapping[f.key];
        if (header && headerIndex.has(header)) raw[f.key] = cells[headerIndex.get(header)!];
      }
      const parsed = parseRow(type, raw, prefer);

      // Matching
      let matchedAdId: string | null = null;
      let matchedBy: 'id' | 'name' | null = null;
      let matchedAdName: string | null = null;
      if (parsed.metaAdId && byMetaId.has(parsed.metaAdId)) {
        matchedAdId = byMetaId.get(parsed.metaAdId)!;
        matchedBy = 'id';
      } else if (!parsed.metaAdId && parsed.adName) {
        const hit = byName.get(parsed.adName.toLowerCase());
        if (hit && hit.count === 1) { matchedAdId = hit.id; matchedBy = 'name'; } // nur EINDEUTIG, nie fuzzy
      }
      if (matchedAdId) matchedAdName = ads.find((a) => a.id === matchedAdId)?.name ?? null;

      let status: RowStatus;
      if (parsed.errors.length) status = 'invalid';
      else if (!matchedAdId) status = 'unknown';
      else status = parsed.warnings.length ? 'warning' : 'ready';

      preview.push({
        rowIndex: i + 2, // +2: 1-basiert + Kopfzeile
        metaAdId: parsed.metaAdId ?? null,
        adName: parsed.adName ?? null,
        date: parsed.date,
        dateAmbiguous: parsed.dateAmbiguous,
        values: parsed.values,
        matchedAdId,
        matchedAdName,
        matchedBy,
        status,
        errors: parsed.errors,
        warnings: parsed.warnings,
      });
    }

    // Duplikate markieren (vorhandene ad_id+date).
    const matched = preview.filter((r) => r.matchedAdId && r.date && r.status !== 'invalid');
    if (matched.length) {
      const adIds = [...new Set(matched.map((r) => r.matchedAdId!))];
      const dates = matched.map((r) => new Date(r.date!));
      const min = new Date(Math.min(...dates.map((d) => d.getTime())));
      const max = new Date(Math.max(...dates.map((d) => d.getTime())));
      const existing = await this.prisma.maAdDailyMetric.findMany({
        where: { orgId, adId: { in: adIds }, date: { gte: min, lte: max } },
        select: { adId: true, date: true },
      });
      const existSet = new Set(existing.map((e) => `${e.adId}|${e.date.toISOString().slice(0, 10)}`));
      for (const r of matched) {
        if (existSet.has(`${r.matchedAdId}|${r.date}`)) r.status = 'duplicate';
      }
    }

    const summary = this.summarize(preview);
    return { type, filename: file.originalname, headers, mapping, unmapped: detected.unmapped, rows: preview, summary };
  }

  private summarize(rows: AnalyzePreviewRow[]) {
    const c = (s: RowStatus) => rows.filter((r) => r.status === s).length;
    return {
      total: rows.length,
      ready: c('ready'),
      warning: c('warning'),
      unknown: c('unknown'),
      duplicate: c('duplicate'),
      invalid: c('invalid'),
    };
  }

  // =========================================================================
  // COMMIT — persistieren (Merge-Upsert, Null-sicher, teil-erfolg erlaubt)
  // =========================================================================

  async commit(
    orgId: string,
    userId: string,
    type: ImportType,
    filename: string,
    mappingConfig: Record<string, string | null> | undefined,
    rows: CommitRow[],
  ) {
    if (!Array.isArray(rows)) throw new BadRequestException('rows fehlt');
    let success = 0, updated = 0, skipped = 0, errors = 0;
    const errorDetails: { row: number; message: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      try {
        if (r.action === 'skip') { skipped++; continue; }
        if (!r.date || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) throw new Error('Ungültiges Datum');
        this.validateNumeric(r.values);

        // Ad bestimmen / anlegen
        let adId = r.adId ?? null;
        if (!adId && r.createAd) {
          const created = await this.ads.createAd(orgId, r.createAd);
          adId = created.id;
        }
        if (!adId) throw new Error('Keine Ziel-Ad (adId oder createAd erforderlich)');

        // Nur gelieferte Felder → Merge (vorhandene Fremdfelder bleiben unberührt).
        const data = this.pickValues(r.values);
        const date = new Date(r.date);
        const existed = await this.prisma.maAdDailyMetric.findUnique({
          where: { adId_date: { adId, date } },
          select: { id: true },
        });
        await this.prisma.maAdDailyMetric.upsert({
          where: { adId_date: { adId, date } },
          update: data,
          create: { orgId, adId, date, ...data },
        });
        if (existed) updated++; else success++;
      } catch (e) {
        errors++;
        errorDetails.push({ row: i + 1, message: e instanceof Error ? e.message : 'Fehler' });
      }
    }

    const status = errors === 0 ? 'completed' : (success + updated > 0 ? 'partial' : 'failed');
    const record = await this.prisma.maDataImport.create({
      data: {
        orgId, type, filename: filename?.slice(0, 400) || 'import',
        uploadedById: userId,
        rowCount: rows.length,
        successCount: success,
        errorCount: errors,
        skippedCount: skipped,
        updatedCount: updated,
        status,
        mappingConfig: (mappingConfig ?? undefined) as Prisma.InputJsonValue,
        errorSummary: (errorDetails.length ? errorDetails.slice(0, 200) : undefined) as Prisma.InputJsonValue,
      },
    });

    return {
      importId: record.id, status,
      summary: { total: rows.length, created: success, updated, skipped, errors },
      errorDetails: errorDetails.slice(0, 50),
    };
  }

  private validateNumeric(values: Record<string, number> | undefined) {
    if (!values) return;
    for (const k of NUMERIC_KEYS) {
      const v = values[k];
      if (v === undefined || v === null) continue;
      if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`${k} ungültig`);
      if (v < 0) throw new Error(`${k} darf nicht negativ sein`);
      if (RATE_KEYS.has(k) && v > 100) throw new Error(`${k} muss zwischen 0 und 100 liegen`);
    }
  }

  private pickValues(values: Record<string, number> | undefined): Record<string, number> {
    const out: Record<string, number> = {};
    if (!values) return out;
    for (const k of NUMERIC_KEYS) {
      if (values[k] !== undefined && values[k] !== null) out[k] = values[k];
    }
    return out;
  }

  // =========================================================================
  // HISTORY
  // =========================================================================

  async history(orgId: string) {
    const rows = await this.prisma.maDataImport.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return { items: rows.map((r) => this.serialize(r)) };
  }

  async getImport(orgId: string, id: string) {
    const r = await this.prisma.maDataImport.findFirst({ where: { id, orgId } });
    if (!r) throw new NotFoundException('Import nicht gefunden');
    return this.serialize(r);
  }

  private serialize(r: any) {
    return {
      id: r.id, type: r.type, filename: r.filename,
      uploadedById: r.uploadedById ?? null,
      rowCount: r.rowCount, successCount: r.successCount, errorCount: r.errorCount,
      skippedCount: r.skippedCount, updatedCount: r.updatedCount, status: r.status,
      mappingConfig: r.mappingConfig ?? null, errorSummary: r.errorSummary ?? null,
      createdAt: r.createdAt?.toISOString?.() ?? null,
    };
  }

  // =========================================================================
  // Datei-Parsing (CSV + XLSX)
  // =========================================================================

  private async parseFile(buffer: Buffer, filename: string): Promise<{ headers: string[]; rows: string[][] }> {
    const isXlsx = /\.xlsx$/i.test(filename) || this.looksLikeZip(buffer);
    if (isXlsx) return this.parseXlsx(buffer);
    return this.parseCsv(buffer);
  }

  private looksLikeZip(buf: Buffer): boolean {
    return buf.length > 1 && buf[0] === 0x50 && buf[1] === 0x4b; // "PK" (xlsx = zip)
  }

  private parseCsv(buffer: Buffer): { headers: string[]; rows: string[][] } {
    const text = buffer.toString('utf8').replace(/^﻿/, '');
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (!lines.length) return { headers: [], rows: [] };
    const sep = this.detectSeparator(lines[0]);
    const headers = this.parseLine(lines[0], sep).map((h) => h.trim());
    const rows = lines.slice(1).map((l) => this.parseLine(l, sep));
    return { headers, rows };
  }

  private detectSeparator(headerLine: string): string {
    const counts: [string, number][] = [
      [';', (headerLine.match(/;/g) || []).length],
      [',', (headerLine.match(/,/g) || []).length],
      ['\t', (headerLine.match(/\t/g) || []).length],
    ];
    counts.sort((a, b) => b[1] - a[1]);
    return counts[0][1] > 0 ? counts[0][0] : ',';
  }

  private parseLine(line: string, sep: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === sep && !inQ) { result.push(cur); cur = ''; }
      else cur += ch;
    }
    result.push(cur);
    return result.map((c) => c.trim());
  }

  private async parseXlsx(buffer: Buffer): Promise<{ headers: string[]; rows: string[][] }> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];
    if (!ws) return { headers: [], rows: [] };
    const all: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const vals = (row.values as any[]) ?? [];
      // exceljs: Index 0 ist leer (1-basiert)
      const cells = vals.slice(1).map((c) => this.cellToString(c));
      all.push(cells);
    });
    if (!all.length) return { headers: [], rows: [] };
    const headers = all[0].map((h) => (h ?? '').trim());
    return { headers, rows: all.slice(1) };
  }

  private cellToString(c: any): string {
    if (c == null) return '';
    if (c instanceof Date) return c.toISOString().slice(0, 10);
    if (typeof c === 'object') {
      if (typeof c.text === 'string') return c.text;        // richtext/hyperlink
      if (typeof c.result !== 'undefined') return String(c.result); // formula
      if (typeof c.hyperlink === 'string' && c.text) return String(c.text);
    }
    return String(c);
  }
}
