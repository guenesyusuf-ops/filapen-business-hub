import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CalculationService, ComputedMonth } from './calculation.service';

export interface MonthEntry {
  year: number;
  month: number;
  netSales: string;
  profit: string;
  margin: string | null;
}

export interface RankingsResult {
  months: MonthEntry[];
  bestRevenueMonth: MonthEntry | null;
  worstRevenueMonth: MonthEntry | null;
  bestProfitMonth: MonthEntry | null;
  worstProfitMonth: MonthEntry | null;
  bestMarginMonth: MonthEntry | null;
  worstMarginMonth: MonthEntry | null;
}

/**
 * §61 Historische Rankings — bester/schlechtester Monat auf verschiedenen
 * Achsen. Fuer die letzten 12 Monate.
 */
@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calc: CalculationService,
  ) {}

  async lastMonths(orgId: string, count = 12): Promise<RankingsResult> {
    // Alle Monate mit Daten holen (max letzte N)
    const monthRows = await this.prisma.paMonth.findMany({
      where: { orgId },
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: count,
    });

    const entries: MonthEntry[] = await Promise.all(monthRows.map(async (m) => {
      const c = await this.calc.computeMonth(orgId, m.year, m.month);
      return {
        year: m.year,
        month: m.month,
        netSales: c.netSalesWithWholesale,
        profit: c.operatingProfit,
        margin: c.operatingMargin,
      };
    }));

    // Ausschliessen: Monate ohne Netto-Umsatz (leer)
    const withData = entries.filter((e) => Number(e.netSales) > 0);

    const bestRevenue = winner(withData, (a, b) => Number(a.netSales) - Number(b.netSales), 'max');
    const worstRevenue = winner(withData, (a, b) => Number(a.netSales) - Number(b.netSales), 'min');
    const bestProfit = winner(withData, (a, b) => Number(a.profit) - Number(b.profit), 'max');
    const worstProfit = winner(withData, (a, b) => Number(a.profit) - Number(b.profit), 'min');
    const withMargin = withData.filter((e) => e.margin !== null);
    const bestMargin = winner(withMargin, (a, b) => Number(a.margin) - Number(b.margin), 'max');
    const worstMargin = winner(withMargin, (a, b) => Number(a.margin) - Number(b.margin), 'min');

    return {
      months: entries,
      bestRevenueMonth: bestRevenue,
      worstRevenueMonth: worstRevenue,
      bestProfitMonth: bestProfit,
      worstProfitMonth: worstProfit,
      bestMarginMonth: bestMargin,
      worstMarginMonth: worstMargin,
    };
  }
}

function winner<T>(arr: T[], cmp: (a: T, b: T) => number, mode: 'max' | 'min'): T | null {
  if (arr.length === 0) return null;
  return arr.reduce((acc, cur) => {
    const c = cmp(cur, acc);
    if (mode === 'max' && c > 0) return cur;
    if (mode === 'min' && c < 0) return cur;
    return acc;
  });
}
