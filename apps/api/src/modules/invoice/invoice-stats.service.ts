import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InvoiceStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Liefert das komplette Dashboard-Datenpaket in einem Roundtrip:
   * - Top-Kennzahlen (offen/faellig/ueberfaellig/bezahlt + Summen)
   * - Monatliche Ausgaben (letzte 12 Monate)
   * - Ausgaben nach Kategorie
   * - Top 5 Lieferanten nach Gesamtausgaben
   * - Liquiditaets-Widget (faellig 7d/30d, ueberfaellig, dieser Monat)
   */
  async dashboard(orgId: string) {
    const base = { orgId, archived: false };

    const [counts, sumOpen, sumPaid, byCategory, topSuppliers, monthly, cashflow] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['status'],
        where: base,
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...base, status: { not: 'paid' } },
        _sum: { grossAmount: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...base, status: 'paid' },
        _sum: { grossAmount: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['category'],
        where: base,
        _sum: { grossAmount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['supplierName'],
        where: { ...base, supplierName: { not: null } },
        _sum: { grossAmount: true },
        _count: { _all: true },
        orderBy: { _sum: { grossAmount: 'desc' } },
        take: 5,
      }),
      this.monthlySpend(orgId),
      this.cashflow(orgId),
    ]);

    const countsMap = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

    return {
      kpis: {
        open: countsMap.open ?? 0,
        due_soon: countsMap.due_soon ?? 0,
        due_today: countsMap.due_today ?? 0,
        overdue: countsMap.overdue ?? 0,
        paid: countsMap.paid ?? 0,
        sumOpen: toNum(sumOpen._sum.grossAmount),
        sumPaid: toNum(sumPaid._sum.grossAmount),
      },
      monthly,
      byCategory: byCategory
        .map((c) => ({
          category: c.category,
          total: toNum(c._sum.grossAmount),
          count: c._count._all,
        }))
        .sort((a, b) => b.total - a.total),
      topSuppliers: topSuppliers.map((s) => ({
        supplierName: s.supplierName,
        total: toNum(s._sum.grossAmount),
        count: s._count._all,
      })),
      cashflow,
    };
  }

  /**
   * Liefert pro Monat (letzte 12) die Summe aller Brutto-Beträge —
   * basierend auf invoiceDate (nicht createdAt), damit das Bild matched
   * was tatsaechlich auf den Rechnungen steht.
   */
  private async monthlySpend(orgId: string) {
    const since = new Date();
    since.setMonth(since.getMonth() - 11);
    since.setDate(1);
    since.setHours(0, 0, 0, 0);

    const rows = await this.prisma.invoice.findMany({
      where: {
        orgId,
        archived: false,
        invoiceDate: { gte: since },
      },
      select: { invoiceDate: true, grossAmount: true, status: true },
    });

    // Bucketize per YYYY-MM
    const buckets = new Map<string, { paid: number; unpaid: number }>();
    // Vorinitialisieren fuer alle 12 Monate damit auch leere Monate erscheinen
    for (let i = 0; i < 12; i++) {
      const d = new Date(since);
      d.setMonth(d.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { paid: 0, unpaid: 0 });
    }
    for (const r of rows) {
      if (!r.invoiceDate) continue;
      const key = `${r.invoiceDate.getFullYear()}-${String(r.invoiceDate.getMonth() + 1).padStart(2, '0')}`;
      const bucket = buckets.get(key);
      if (!bucket) continue;
      const value = toNum(r.grossAmount);
      if (r.status === 'paid') bucket.paid += value;
      else bucket.unpaid += value;
    }

    return Array.from(buckets.entries()).map(([month, v]) => ({
      month,
      paid: round2(v.paid),
      unpaid: round2(v.unpaid),
      total: round2(v.paid + v.unpaid),
    }));
  }

  /**
   * Liquiditaets-Widget — wieviel muss ich in den naechsten 7/30 Tagen zahlen.
   */
  private async cashflow(orgId: string) {
    const today = startOfDay(new Date());
    const in7 = new Date(today); in7.setDate(in7.getDate() + 7);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

    const base = { orgId, archived: false, paidAt: null as null };
    const [next7d, next30d, overdueAll, thisMonth] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...base, dueDate: { gte: today, lt: in7 } },
        _sum: { grossAmount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...base, dueDate: { gte: today, lt: in30 } },
        _sum: { grossAmount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...base, dueDate: { lt: today } },
        _sum: { grossAmount: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...base, dueDate: { gte: today, lt: monthEnd } },
        _sum: { grossAmount: true },
        _count: { _all: true },
      }),
    ]);

    return {
      next7d: { total: toNum(next7d._sum.grossAmount), count: next7d._count._all },
      next30d: { total: toNum(next30d._sum.grossAmount), count: next30d._count._all },
      overdue: { total: toNum(overdueAll._sum.grossAmount), count: overdueAll._count._all },
      thisMonth: { total: toNum(thisMonth._sum.grossAmount), count: thisMonth._count._all },
    };
  }
}

function toNum(d: any): number {
  if (d == null) return 0;
  const n = typeof d === 'string' ? Number(d) : Number(d.toString());
  return Number.isFinite(n) ? n : 0;
}
function round2(n: number) { return Math.round(n * 100) / 100; }
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
