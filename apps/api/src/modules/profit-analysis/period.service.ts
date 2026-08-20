import { Injectable, BadRequestException } from '@nestjs/common';
import { CalculationService, ComputedMonth } from './calculation.service';
import { D, toD, round2 } from './domain/decimal';
import { margin } from './domain/margin';

export type PeriodKind = 'month' | 'quarter' | 'year' | 'ytd' | 'custom';

export interface PeriodInput {
  kind: PeriodKind;
  year: number;
  month?: number;         // fuer month
  quarter?: number;       // 1..4, fuer quarter
  fromYear?: number;      // fuer custom
  fromMonth?: number;
  toYear?: number;
  toMonth?: number;
}

export interface PeriodTotal {
  label: string;
  monthCount: number;
  grossSalesTotal: string;
  netSalesTotal: string;
  netSalesWithWholesale: string;
  vatTotal: string;
  adsTotal: string;
  productCostsTotal: string;
  shippingCostsTotal: string;
  platformFeesTotal: string;
  wholesaleProfit: string;
  overheadTotal: string;
  profitBeforeOverhead: string;
  operatingProfit: string;
  marginBeforeOverhead: string | null;
  operatingMargin: string | null;
}

/**
 * §93 Zeitraum-Vergleiche jenseits von Monat-vs-Monat.
 * Aggregiert ComputedMonth ueber beliebige Zeitraum-Definitionen.
 */
@Injectable()
export class PeriodService {
  constructor(private readonly calc: CalculationService) {}

  async compute(orgId: string, input: PeriodInput): Promise<PeriodTotal> {
    const months = this.resolveMonths(input);
    const computeds: ComputedMonth[] = await Promise.all(
      months.map(({ year, month }) => this.calc.computeMonth(orgId, year, month)),
    );
    return this.aggregate(this.labelFor(input), computeds);
  }

  private resolveMonths(input: PeriodInput): Array<{ year: number; month: number }> {
    const now = new Date();
    const result: Array<{ year: number; month: number }> = [];
    switch (input.kind) {
      case 'month':
        if (!input.month) throw new BadRequestException('month fehlt fuer kind=month');
        result.push({ year: input.year, month: input.month });
        break;
      case 'quarter':
        if (!input.quarter || input.quarter < 1 || input.quarter > 4)
          throw new BadRequestException('quarter muss 1..4 sein');
        const startMonth = (input.quarter - 1) * 3 + 1;
        for (let m = startMonth; m < startMonth + 3; m++) result.push({ year: input.year, month: m });
        break;
      case 'year':
        for (let m = 1; m <= 12; m++) result.push({ year: input.year, month: m });
        break;
      case 'ytd':
        const endMonth = input.year === now.getFullYear() ? now.getMonth() + 1 : 12;
        for (let m = 1; m <= endMonth; m++) result.push({ year: input.year, month: m });
        break;
      case 'custom':
        if (!input.fromYear || !input.fromMonth || !input.toYear || !input.toMonth)
          throw new BadRequestException('custom benoetigt from/to Year+Month');
        let y = input.fromYear, m = input.fromMonth;
        while (y < input.toYear || (y === input.toYear && m <= input.toMonth)) {
          result.push({ year: y, month: m });
          m++;
          if (m > 12) { m = 1; y++; }
        }
        break;
    }
    return result;
  }

  private labelFor(input: PeriodInput): string {
    const MONTHS = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
    switch (input.kind) {
      case 'month':   return `${MONTHS[(input.month ?? 1) - 1]} ${input.year}`;
      case 'quarter': return `Q${input.quarter} ${input.year}`;
      case 'year':    return `${input.year}`;
      case 'ytd':     return `YTD ${input.year}`;
      case 'custom':  return `${MONTHS[(input.fromMonth ?? 1) - 1]} ${input.fromYear} – ${MONTHS[(input.toMonth ?? 1) - 1]} ${input.toYear}`;
    }
  }

  private aggregate(label: string, months: ComputedMonth[]): PeriodTotal {
    let grossSales = toD(0), netSales = toD(0), netSalesWithWs = toD(0);
    let vat = toD(0), ads = toD(0);
    let productCosts = toD(0), shipping = toD(0), fees = toD(0);
    let wholesaleProfit = toD(0), overhead = toD(0);
    let profitBefore = toD(0), opProfit = toD(0);

    let monthCount = 0;
    for (const m of months) {
      if (Number(m.netSalesWithWholesale) > 0 || m.days.length > 0) monthCount++;
      grossSales = grossSales.plus(toD(m.totals.grossSalesTotal));
      netSales = netSales.plus(toD(m.totals.netSalesTotal));
      netSalesWithWs = netSalesWithWs.plus(toD(m.netSalesWithWholesale));
      vat = vat.plus(toD(m.totals.vatTotal));
      ads = ads.plus(toD(m.totals.adsTotal));
      productCosts = productCosts.plus(toD(m.totals.productCostsTotal));
      shipping = shipping.plus(toD(m.totals.shippingCostsTotal));
      fees = fees.plus(toD(m.totals.platformFeesTotal));
      wholesaleProfit = wholesaleProfit.plus(toD(m.wholesale.totalProfit));
      overhead = overhead.plus(toD(m.overhead.totalNet));
      profitBefore = profitBefore.plus(toD(m.profitBeforeOverheadWithWholesale));
      opProfit = opProfit.plus(toD(m.operatingProfit));
    }

    return {
      label,
      monthCount,
      grossSalesTotal: round2(grossSales).toString(),
      netSalesTotal: round2(netSales).toString(),
      netSalesWithWholesale: round2(netSalesWithWs).toString(),
      vatTotal: round2(vat).toString(),
      adsTotal: round2(ads).toString(),
      productCostsTotal: round2(productCosts).toString(),
      shippingCostsTotal: round2(shipping).toString(),
      platformFeesTotal: round2(fees).toString(),
      wholesaleProfit: round2(wholesaleProfit).toString(),
      overheadTotal: round2(overhead).toString(),
      profitBeforeOverhead: round2(profitBefore).toString(),
      operatingProfit: round2(opProfit).toString(),
      marginBeforeOverhead: margin(profitBefore.minus(wholesaleProfit), netSales)?.toString() ?? null,
      operatingMargin: margin(opProfit, netSalesWithWs)?.toString() ?? null,
    };
  }
}
