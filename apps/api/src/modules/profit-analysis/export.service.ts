import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import PdfPrinter from 'pdfmake';
import { CalculationService, ComputedMonth } from './calculation.service';
import { DailyDataService } from './daily-data.service';

/**
 * Export-Formate:
 *   - CSV (UTF-8 BOM, Semikolon, deutsches Format) — Rohdaten
 *   - XLSX — Monatsbericht mit mehreren Sheets, Formatierung, Summen-Row
 *   - PDF — Management-Bericht mit KPI-Zusammenfassung + Kanal-Aufteilung
 */

const MONTH_LABELS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

@Injectable()
export class ExportService {
  constructor(
    private readonly calc: CalculationService,
    private readonly daily: DailyDataService,
  ) {}

  // ===========================================================================
  // CSV
  // ===========================================================================
  async exportMonthCsv(orgId: string, year: number, month: number): Promise<{ filename: string; content: string }> {
    const [raw, computed] = await Promise.all([
      this.daily.getMonthRaw(orgId, year, month),
      this.calc.computeMonth(orgId, year, month),
    ]);

    const rows: string[][] = [];
    rows.push([
      'Datum',
      'Shopify Brutto', 'Shopify USt', 'Shopify Netto',
      'Amazon Brutto',  'Amazon USt',  'Amazon Netto',
      'TikTok Brutto',  'TikTok USt',  'TikTok Netto',
      'Meta', 'Google', 'Influencer', 'Amazon PPC', 'TikTok Ads',
      'DHL Pakete Shopify', 'DHL Pakete TikTok',
      'Webshop Profit', 'Webshop Marge %', 'Webshop Netto ROAS',
      'Amazon Profit',  'Amazon Marge %',  'Amazon Netto ROAS',
      'TikTok Profit',  'TikTok Marge %',  'TikTok Netto ROAS',
      'Tagesgewinn', 'Tagesmarge %',
    ]);
    const rawByDate = new Map(raw.days.map((d) => [d.date, d]));
    for (const d of computed.days) {
      const rd = rawByDate.get(d.date);
      rows.push([
        this.date(d.date),
        this.money(d.shopify.vat.grossAdjusted), this.money(d.shopify.vat.vatTotal), this.money(d.shopify.profit.netSales),
        this.money(d.amazon.vat.grossAdjusted),  this.money(d.amazon.vat.vatTotal),  this.money(d.amazon.profit.netSales),
        this.money(d.tiktok.vat.grossAdjusted),  this.money(d.tiktok.vat.vatTotal),  this.money(d.tiktok.profit.netSales),
        this.money(rd?.ads.meta ?? '0'), this.money(rd?.ads.google ?? '0'), this.money(rd?.ads.influencer ?? '0'),
        this.money(rd?.ads.amazonPpc ?? '0'), this.money(rd?.ads.tiktokAds ?? '0'),
        String(rd?.shipping.shopifyPackages ?? 0),
        String(rd?.shipping.tiktokPackages ?? 0),
        this.money(d.shopify.profit.profit), this.pct(d.shopify.profit.margin), this.pct(d.shopify.profit.roasNet),
        this.money(d.amazon.profit.profit),  this.pct(d.amazon.profit.margin),  this.pct(d.amazon.profit.roasNet),
        this.money(d.tiktok.profit.profit),  this.pct(d.tiktok.profit.margin),  this.pct(d.tiktok.profit.roasNet),
        this.money(d.aggregate.totalProfit),
        this.pct(d.aggregate.totalMargin),
      ]);
    }
    rows.push([]);
    rows.push(['Monatssumme']);
    rows.push(['Brutto ges.', this.money(computed.totals.grossSalesTotal)]);
    rows.push(['Netto ges.', this.money(computed.totals.netSalesTotal)]);
    rows.push(['USt ges.', this.money(computed.totals.vatTotal)]);
    rows.push(['Werbekosten ges.', this.money(computed.totals.adsTotal)]);
    rows.push(['Produktkosten ges.', this.money(computed.totals.productCostsTotal)]);
    rows.push(['Versandkosten ges.', this.money(computed.totals.shippingCostsTotal)]);
    rows.push(['Plattformgebuehren ges.', this.money(computed.totals.platformFeesTotal)]);
    rows.push(['Profit vor Gemeinkosten (Kanaele)', this.money(computed.totals.profitBeforeOverhead)]);
    rows.push(['Marge vor Gemeinkosten %', this.pct(computed.totals.marginBeforeOverhead)]);
    rows.push([]);
    rows.push(['Grosshandel']);
    rows.push(['Auftraege', String(computed.wholesale.orderCount)]);
    rows.push(['Brutto', this.money(computed.wholesale.totalGross)]);
    rows.push(['Netto', this.money(computed.wholesale.totalNet)]);
    rows.push(['Produktkosten', this.money(computed.wholesale.totalCost)]);
    rows.push(['Gewinn', this.money(computed.wholesale.totalProfit)]);
    rows.push([]);
    rows.push(['Gemeinkosten', 'Netto', '% v. Netto-Umsatz']);
    for (const c of computed.overhead.byCategory) {
      rows.push([c.category, this.money(c.totalNet), this.pct(c.ratioOfNetSales)]);
    }
    rows.push(['Summe Gemeinkosten (Netto)', this.money(computed.overhead.totalNet)]);
    rows.push([]);
    rows.push(['Profit vor Gemeinkosten (Kanaele + Grosshandel)', this.money(computed.profitBeforeOverheadWithWholesale)]);
    rows.push(['Operativer Monatsgewinn', this.money(computed.operatingProfit)]);
    rows.push(['Operative Endmarge %', this.pct(computed.operatingMargin)]);

    const csv = '﻿' + rows.map((r) => r.map((c) => this.esc(c)).join(';')).join('\r\n');
    return {
      filename: `gewinnanalyse-${year}-${String(month).padStart(2, '0')}.csv`,
      content: csv,
    };
  }

  // ===========================================================================
  // XLSX
  // ===========================================================================
  async exportMonthXlsx(orgId: string, year: number, month: number): Promise<{ filename: string; content: Buffer }> {
    const [raw, computed] = await Promise.all([
      this.daily.getMonthRaw(orgId, year, month),
      this.calc.computeMonth(orgId, year, month),
    ]);
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Filapen Business Hub';
    wb.created = new Date();

    // ---- Sheet 1: Tages-Uebersicht --------------------------------------
    const ws = wb.addWorksheet('Tages-Uebersicht', {
      views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }],
    });
    ws.mergeCells('A1:AA1');
    ws.getCell('A1').value = `Gewinnanalyse — ${MONTH_LABELS[month - 1]} ${year}`;
    ws.getCell('A1').font = { size: 14, bold: true };
    ws.getCell('A1').alignment = { horizontal: 'left' };

    const headers = [
      'Datum',
      'Shopify Brutto', 'Shopify USt', 'Shopify Netto',
      'Amazon Brutto',  'Amazon USt',  'Amazon Netto',
      'TikTok Brutto',  'TikTok USt',  'TikTok Netto',
      'Meta', 'Google', 'Influencer', 'Amazon PPC', 'TikTok Ads',
      'DHL Pakete Shopify', 'DHL Pakete TikTok',
      'Webshop Profit', 'Webshop Marge', 'Webshop Netto-ROAS',
      'Amazon Profit',  'Amazon Marge',  'Amazon Netto-ROAS',
      'TikTok Profit',  'TikTok Marge',  'TikTok Netto-ROAS',
      'Tagesgewinn', 'Tagesmarge',
    ];
    const headerRow = ws.getRow(3);
    headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7E6D0' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 24;

    const rawByDate = new Map(raw.days.map((d) => [d.date, d]));
    for (const d of computed.days) {
      const rd = rawByDate.get(d.date);
      ws.addRow([
        this.date(d.date),
        this.num(d.shopify.vat.grossAdjusted), this.num(d.shopify.vat.vatTotal), this.num(d.shopify.profit.netSales),
        this.num(d.amazon.vat.grossAdjusted),  this.num(d.amazon.vat.vatTotal),  this.num(d.amazon.profit.netSales),
        this.num(d.tiktok.vat.grossAdjusted),  this.num(d.tiktok.vat.vatTotal),  this.num(d.tiktok.profit.netSales),
        this.num(rd?.ads.meta ?? '0'), this.num(rd?.ads.google ?? '0'), this.num(rd?.ads.influencer ?? '0'),
        this.num(rd?.ads.amazonPpc ?? '0'), this.num(rd?.ads.tiktokAds ?? '0'),
        rd?.shipping.shopifyPackages ?? 0,
        rd?.shipping.tiktokPackages ?? 0,
        this.num(d.shopify.profit.profit), this.numPct(d.shopify.profit.margin), this.num(d.shopify.profit.roasNet),
        this.num(d.amazon.profit.profit),  this.numPct(d.amazon.profit.margin),  this.num(d.amazon.profit.roasNet),
        this.num(d.tiktok.profit.profit),  this.numPct(d.tiktok.profit.margin),  this.num(d.tiktok.profit.roasNet),
        this.num(d.aggregate.totalProfit),
        this.numPct(d.aggregate.totalMargin),
      ]);
    }

    // Format: Geld-Spalten
    const moneyColumns = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 21, 24, 27];
    moneyColumns.forEach((c) => { ws.getColumn(c).numFmt = '#,##0.00 [$€-407]'; });
    // Prozent-Spalten
    const pctColumns = [19, 22, 25, 28];
    pctColumns.forEach((c) => { ws.getColumn(c).numFmt = '0.00 "%"'; });
    // Column widths
    ws.getColumn(1).width = 12;
    for (let i = 2; i <= headers.length; i++) ws.getColumn(i).width = 16;
    // Sticky Header (already frozen via views)

    // Summen-Zeile am Ende
    const sumRowIdx = ws.rowCount + 2;
    const sumRow = ws.getRow(sumRowIdx);
    sumRow.getCell(1).value = 'Summe';
    sumRow.font = { bold: true };
    sumRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 21, 24, 27].forEach((c) => {
      const col = ws.getColumn(c).letter;
      sumRow.getCell(c).value = { formula: `SUM(${col}4:${col}${sumRowIdx - 2})` } as any;
      sumRow.getCell(c).numFmt = '#,##0.00 [$€-407]';
    });
    sumRow.getCell(16).value = { formula: `SUM(P4:P${sumRowIdx - 2})` } as any;
    sumRow.getCell(17).value = { formula: `SUM(Q4:Q${sumRowIdx - 2})` } as any;

    // ---- Sheet 2: Grosshandel -------------------------------------------
    const wsW = wb.addWorksheet('Grosshandel');
    wsW.getRow(1).values = ['Auftraege', 'Brutto', 'Netto', 'USt', 'Produktkosten', 'Gewinn', 'Marge'];
    wsW.getRow(1).font = { bold: true };
    wsW.addRow([
      computed.wholesale.orderCount,
      this.num(computed.wholesale.totalGross),
      this.num(computed.wholesale.totalNet),
      this.num(computed.wholesale.totalVat),
      this.num(computed.wholesale.totalCost),
      this.num(computed.wholesale.totalProfit),
      this.numPct(computed.wholesale.margin),
    ]);
    [2, 3, 4, 5, 6].forEach((c) => { wsW.getColumn(c).numFmt = '#,##0.00 [$€-407]'; });
    wsW.getColumn(7).numFmt = '0.00 "%"';
    for (let i = 1; i <= 7; i++) wsW.getColumn(i).width = 18;

    // ---- Sheet 3: Gemeinkosten ------------------------------------------
    const wsO = wb.addWorksheet('Gemeinkosten');
    wsO.getRow(1).values = ['Kategorie', 'Bezeichnung', 'Betrag eingegeben', 'Typ', 'USt %', 'Netto', 'Brutto'];
    wsO.getRow(1).font = { bold: true };
    for (const e of computed.overhead.entries) {
      wsO.addRow([
        e.category, e.label,
        this.num(e.enteredAmount), e.isGross ? 'Brutto' : 'Netto', this.num(e.vatRate),
        this.num(e.netAmount), this.num(e.grossAmount),
      ]);
    }
    wsO.addRow([]);
    wsO.addRow(['Summe', '', '', '', '', this.num(computed.overhead.totalNet), this.num(computed.overhead.totalGross)]).font = { bold: true };
    [3, 6, 7].forEach((c) => { wsO.getColumn(c).numFmt = '#,##0.00 [$€-407]'; });
    wsO.getColumn(5).numFmt = '0.00 "%"';
    [1, 2, 3, 4, 5, 6, 7].forEach((c, i) => { wsO.getColumn(c).width = i === 1 ? 25 : 15; });

    // ---- Sheet 4: Endergebnis -------------------------------------------
    const wsR = wb.addWorksheet('Endergebnis');
    const kpis: Array<[string, any]> = [
      ['Brutto-Umsatz ges.', this.num(computed.totals.grossSalesTotal)],
      ['Netto-Umsatz ges. (Kanäle)', this.num(computed.totals.netSalesTotal)],
      ['Netto-Umsatz inkl. Grosshandel', this.num(computed.netSalesWithWholesale)],
      ['USt aus Verkäufen', this.num(computed.totals.vatTotal)],
      ['Werbekosten ges.', this.num(computed.totals.adsTotal)],
      ['Produktkosten ges.', this.num(computed.totals.productCostsTotal)],
      ['Versandkosten ges.', this.num(computed.totals.shippingCostsTotal)],
      ['Plattformgebühren ges.', this.num(computed.totals.platformFeesTotal)],
      ['Grosshandelsgewinn', this.num(computed.wholesale.totalProfit)],
      ['Profit vor Gemeinkosten (Kanäle + Grosshandel)', this.num(computed.profitBeforeOverheadWithWholesale)],
      ['Gemeinkosten (Netto)', this.num(computed.overhead.totalNet)],
      ['Operativer Monatsgewinn', this.num(computed.operatingProfit)],
      ['Operative Endmarge %', this.numPct(computed.operatingMargin)],
    ];
    kpis.forEach(([label, val]) => wsR.addRow([label, val]));
    wsR.getColumn(1).width = 45;
    wsR.getColumn(2).width = 20;
    wsR.getColumn(2).numFmt = '#,##0.00 [$€-407]';
    wsR.getRow(kpis.length).font = { bold: true };
    wsR.getRow(kpis.length).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
    // Endmarge nutzt Prozent-Format
    wsR.getCell(`B${kpis.length}`).numFmt = '0.00 "%"';

    const buffer = await wb.xlsx.writeBuffer();
    return {
      filename: `gewinnanalyse-${year}-${String(month).padStart(2, '0')}.xlsx`,
      content: Buffer.from(buffer),
    };
  }

  // ===========================================================================
  // PDF (Management-Bericht — keine Rohdaten-Tabelle)
  // ===========================================================================
  async exportMonthPdf(orgId: string, year: number, month: number): Promise<{ filename: string; content: Buffer }> {
    const computed = await this.calc.computeMonth(orgId, year, month);

    // pdfmake benötigt Fonts — wir nutzen die Standard-Roboto-Variante die im
    // pdfmake-Paket mitgeliefert wird (vfs_fonts). Fuer Node-side ohne vfs
    // registrieren wir minimal Helvetica-aehnliche Fonts.
    const printer = new PdfPrinter({
      Helvetica: {
        normal: 'Helvetica',
        bold: 'Helvetica-Bold',
        italics: 'Helvetica-Oblique',
        bolditalics: 'Helvetica-BoldOblique',
      },
    });

    const monthLabel = `${MONTH_LABELS[month - 1]} ${year}`;
    const opProfitNum = Number(computed.operatingProfit);

    const doc: any = {
      defaultStyle: { font: 'Helvetica', fontSize: 10 },
      pageSize: 'A4',
      pageMargins: [40, 40, 40, 40],
      content: [
        { text: 'Gewinnanalyse', style: 'h1' },
        { text: monthLabel, style: 'h2', margin: [0, 0, 0, 12] },

        // KPI-Kacheln (oberes Grid)
        {
          columns: [
            this.kpiBox('Netto-Umsatz', this.moneyStr(computed.netSalesWithWholesale)),
            this.kpiBox('Operativer Monatsgewinn', this.moneyStr(computed.operatingProfit),
              opProfitNum < 0 ? 'critical' : 'good'),
            this.kpiBox('Operative Endmarge', this.pctStr(computed.operatingMargin)),
          ],
          columnGap: 10,
          margin: [0, 0, 0, 16],
        },

        { text: 'Umsatz je Kanal (Netto)', style: 'h3' },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              ['Shopify', { text: this.moneyStr(this.channelNet(computed, 'shopify')), alignment: 'right' }],
              ['Amazon',  { text: this.moneyStr(this.channelNet(computed, 'amazon')),  alignment: 'right' }],
              ['TikTok',  { text: this.moneyStr(this.channelNet(computed, 'tiktok')),  alignment: 'right' }],
              ['Grosshandel', { text: this.moneyStr(computed.wholesale.totalNet), alignment: 'right' }],
              [{ text: 'Netto ges.', bold: true }, { text: this.moneyStr(computed.netSalesWithWholesale), alignment: 'right', bold: true }],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 4, 0, 12],
        },

        { text: 'Kostenübersicht', style: 'h3' },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              ['Produktkosten',      { text: this.moneyStr(computed.totals.productCostsTotal),  alignment: 'right' }],
              ['Versandkosten',      { text: this.moneyStr(computed.totals.shippingCostsTotal), alignment: 'right' }],
              ['Plattformgebühren',  { text: this.moneyStr(computed.totals.platformFeesTotal),  alignment: 'right' }],
              ['Werbekosten',        { text: this.moneyStr(computed.totals.adsTotal),           alignment: 'right' }],
              ['Gemeinkosten (Netto)', { text: this.moneyStr(computed.overhead.totalNet),       alignment: 'right' }],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 4, 0, 12],
        },

        { text: 'Ergebnisse', style: 'h3' },
        {
          table: {
            widths: ['*', 'auto'],
            body: [
              ['Profit vor Gemeinkosten (Kanäle)',            { text: this.moneyStr(computed.totals.profitBeforeOverhead), alignment: 'right' }],
              ['Grosshandelsgewinn',                          { text: this.moneyStr(computed.wholesale.totalProfit),       alignment: 'right' }],
              ['Profit vor Gemeinkosten (Kanäle + Grosshdl)', { text: this.moneyStr(computed.profitBeforeOverheadWithWholesale), alignment: 'right' }],
              ['− Gemeinkosten',                              { text: '− ' + this.moneyStr(computed.overhead.totalNet),    alignment: 'right' }],
              [{ text: 'Operativer Monatsgewinn', bold: true }, { text: this.moneyStr(computed.operatingProfit), alignment: 'right', bold: true }],
              [{ text: 'Operative Endmarge', bold: true },      { text: this.pctStr(computed.operatingMargin), alignment: 'right', bold: true }],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 4, 0, 12],
        },

        { text: `Generiert am ${new Date().toLocaleDateString('de-DE')} · Filapen Business Hub`, style: 'footer', margin: [0, 20, 0, 0] },
      ],
      styles: {
        h1: { fontSize: 20, bold: true, color: '#111827' },
        h2: { fontSize: 14, color: '#6B7280' },
        h3: { fontSize: 12, bold: true, color: '#111827', margin: [0, 8, 0, 0] },
        footer: { fontSize: 8, color: '#9CA3AF' },
      },
    };

    return new Promise((resolve) => {
      const pdfDoc = printer.createPdfKitDocument(doc);
      const chunks: Buffer[] = [];
      pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on('end', () => resolve({
        filename: `gewinnanalyse-${year}-${String(month).padStart(2, '0')}.pdf`,
        content: Buffer.concat(chunks),
      }));
      pdfDoc.end();
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private channelNet(c: ComputedMonth, ch: 'shopify' | 'amazon' | 'tiktok'): string {
    return c.days.reduce((sum, d) => sum + Number((d as any)[ch].profit.netSales), 0).toFixed(2);
  }

  private kpiBox(label: string, value: string, tone?: 'good' | 'critical') {
    const color = tone === 'critical' ? '#DC2626' : tone === 'good' ? '#059669' : '#111827';
    return {
      table: {
        widths: ['*'],
        body: [
          [{ text: label, fontSize: 8, color: '#6B7280' }],
          [{ text: value, fontSize: 14, bold: true, color }],
        ],
      },
      layout: {
        hLineWidth: () => 0, vLineWidth: () => 0,
        fillColor: () => '#F9FAFB',
        paddingTop: () => 8, paddingBottom: () => 8, paddingLeft: () => 12, paddingRight: () => 12,
      },
    };
  }

  private money(v: any): string {
    if (v === null || v === undefined || v === '') return '';
    const num = Number(v.toString ? v.toString() : v);
    if (!Number.isFinite(num)) return '';
    return num.toFixed(2).replace('.', ',');
  }
  private moneyStr(v: any): string {
    if (v === null || v === undefined || v === '') return '—';
    const num = Number(v.toString ? v.toString() : v);
    if (!Number.isFinite(num)) return '—';
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(num);
  }
  private num(v: any): number {
    if (v === null || v === undefined || v === '') return 0;
    const num = Number(v.toString ? v.toString() : v);
    return Number.isFinite(num) ? num : 0;
  }
  private numPct(v: any): number {
    return this.num(v);
  }
  private pct(v: any): string {
    if (v === null || v === undefined) return '';
    const num = Number(v.toString ? v.toString() : v);
    if (!Number.isFinite(num)) return '';
    return num.toFixed(2).replace('.', ',');
  }
  private pctStr(v: any): string {
    if (v === null || v === undefined) return '—';
    const num = Number(v.toString ? v.toString() : v);
    if (!Number.isFinite(num)) return '—';
    return num.toFixed(2).replace('.', ',') + ' %';
  }
  private date(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }
  private esc(v: string): string {
    if (v === undefined || v === null) return '';
    const s = String(v);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
}
