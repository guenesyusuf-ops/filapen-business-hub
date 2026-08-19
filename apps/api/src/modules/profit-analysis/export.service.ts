import { Injectable } from '@nestjs/common';
import { CalculationService, ComputedMonth } from './calculation.service';
import { DailyDataService } from './daily-data.service';

/**
 * CSV-Export nach dem etablierten Muster von SalesExportService:
 * UTF-8 BOM, Semikolon-Trenner, deutsches Zahlenformat (Komma).
 *
 * XLSX + PDF bewusst OFFEN: nutze CSV als generisches Rohdaten-Format;
 * fuer XLSX kann man das CSV in Excel oeffnen "Als CSV importieren".
 * Wenn spaeter exceljs/pdfmake gewuenscht: Endpoint bleibt gleich, hier
 * getauscht.
 */
@Injectable()
export class ExportService {
  constructor(
    private readonly calc: CalculationService,
    private readonly daily: DailyDataService,
  ) {}

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

    // Monatssumme + Wholesale + Overhead + Endergebnis
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

  private money(v: any): string {
    if (v === null || v === undefined || v === '') return '';
    const num = Number(v.toString ? v.toString() : v);
    if (!Number.isFinite(num)) return '';
    return num.toFixed(2).replace('.', ',');
  }
  private pct(v: any): string {
    if (v === null || v === undefined) return '';
    const num = Number(v.toString ? v.toString() : v);
    if (!Number.isFinite(num)) return '';
    return num.toFixed(2).replace('.', ',');
  }
  private date(iso: string): string {
    // 2026-08-20 -> 20.08.2026
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  }
  private esc(v: string): string {
    if (v === undefined || v === null) return '';
    const s = String(v);
    if (s.includes(';') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
}
