import { Injectable, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * §62 Ziele + §38 Margen-Schwellen.
 *
 * Verwendet die bestehende pa_target Tabelle. Werte werden per key gespeichert;
 * year+month optional (NULL = org-globaler Default). Der Frontend fragt den
 * aktuell relevanten Wert fuer ein Jahr/Monat ab.
 */

export const TARGET_KEYS = {
  MARGIN_TARGET: 'margin_target',                // Standard 30
  MARGIN_GOOD_FROM: 'margin_good_from',          // Standard 25
  MARGIN_CRITICAL_BELOW: 'margin_critical_below',// Standard 20

  ROAS_TARGET_SHOPIFY: 'roas_target_shopify',
  ROAS_TARGET_AMAZON: 'roas_target_amazon',
  ROAS_TARGET_TIKTOK: 'roas_target_tiktok',

  MONTHLY_REVENUE_TARGET: 'monthly_revenue_target',
  MONTHLY_PROFIT_TARGET: 'monthly_profit_target',
} as const;

export type TargetKey = (typeof TARGET_KEYS)[keyof typeof TARGET_KEYS];

export const TARGET_DEFAULTS: Record<TargetKey, string> = {
  [TARGET_KEYS.MARGIN_TARGET]: '30',
  [TARGET_KEYS.MARGIN_GOOD_FROM]: '25',
  [TARGET_KEYS.MARGIN_CRITICAL_BELOW]: '20',
  [TARGET_KEYS.ROAS_TARGET_SHOPIFY]: '3',
  [TARGET_KEYS.ROAS_TARGET_AMAZON]: '4',
  [TARGET_KEYS.ROAS_TARGET_TIKTOK]: '3',
  [TARGET_KEYS.MONTHLY_REVENUE_TARGET]: '0',
  [TARGET_KEYS.MONTHLY_PROFIT_TARGET]: '0',
};

export interface TargetItem {
  key: TargetKey;
  value: string;
  year: number | null;
  month: number | null;
}

@Injectable()
export class TargetService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Findet den relevanten Wert fuer year+month. Priorisiert:
   *   1. spezifischer (year, month)-Eintrag
   *   2. year-only Eintrag
   *   3. org-globaler (year=NULL, month=NULL)
   *   4. Default aus TARGET_DEFAULTS
   */
  async resolveValue(orgId: string, key: TargetKey, year?: number, month?: number): Promise<string> {
    if (!(key in TARGET_DEFAULTS)) throw new BadRequestException(`Unbekannter Target-Key: ${key}`);
    const candidates = await this.prisma.paTarget.findMany({
      where: {
        orgId, key,
        OR: [
          { year: null, month: null },
          ...(year !== undefined ? [{ year, month: null }] : []),
          ...(year !== undefined && month !== undefined ? [{ year, month }] : []),
        ],
      },
    });
    // Priorisierung
    const specific = candidates.find((c) => c.year === year && c.month === month);
    if (specific) return specific.value.toString();
    const yearOnly = candidates.find((c) => c.year === year && c.month === null);
    if (yearOnly) return yearOnly.value.toString();
    const global = candidates.find((c) => c.year === null && c.month === null);
    if (global) return global.value.toString();
    return TARGET_DEFAULTS[key];
  }

  /** Alle org-globalen Defaults (nur year=NULL, month=NULL). */
  async listDefaults(orgId: string): Promise<TargetItem[]> {
    const rows = await this.prisma.paTarget.findMany({
      where: { orgId, year: null, month: null },
      orderBy: { key: 'asc' },
    });
    return (Object.keys(TARGET_DEFAULTS) as TargetKey[]).map((key) => {
      const row = rows.find((r) => r.key === key);
      return {
        key,
        value: row ? row.value.toString() : TARGET_DEFAULTS[key],
        year: null, month: null,
      };
    });
  }

  /** Alle Ziele fuer ein spezifisches Jahr+Monat (mit Vererbung). */
  async listForMonth(orgId: string, year: number, month: number): Promise<TargetItem[]> {
    const items = await Promise.all(
      (Object.keys(TARGET_DEFAULTS) as TargetKey[]).map(async (key) => ({
        key,
        value: await this.resolveValue(orgId, key, year, month),
        year, month,
      })),
    );
    return items;
  }

  /**
   * Setzt/aendert einen Zielwert. year=null+month=null -> org-Default.
   * Ist Upsert (delete + insert wenn value 0/leer? nein, immer schreiben).
   */
  async setValue(
    orgId: string, key: TargetKey, value: string,
    year: number | null = null, month: number | null = null,
  ) {
    if (!(key in TARGET_DEFAULTS)) throw new BadRequestException(`Unbekannter Target-Key: ${key}`);
    const parsed = this.parseValue(value);
    if (year === null && month !== null) {
      throw new BadRequestException('month ohne year ist nicht erlaubt');
    }
    if (month !== null && (month < 1 || month > 12)) {
      throw new BadRequestException('month muss 1..12 sein');
    }
    // Find existing
    const existing = await this.prisma.paTarget.findFirst({
      where: { orgId, key, year, month },
    });
    if (existing) {
      return this.prisma.paTarget.update({
        where: { id: existing.id },
        data: { value: parsed },
      });
    }
    return this.prisma.paTarget.create({
      data: { orgId, key, value: parsed, year, month },
    });
  }

  async delete(orgId: string, id: string) {
    const row = await this.prisma.paTarget.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!row) return { ok: false };
    await this.prisma.paTarget.delete({ where: { id } });
    return { ok: true };
  }

  private parseValue(input: string): Prisma.Decimal {
    if (typeof input !== 'string') throw new BadRequestException('Wert muss String sein');
    const norm = input.trim().replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(norm)) throw new BadRequestException(`Ungueltiger Wert: "${input}"`);
    return new Prisma.Decimal(norm);
  }
}
