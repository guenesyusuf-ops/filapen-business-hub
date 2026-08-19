import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  SETTING_KEYS,
  SETTING_DEFAULTS,
  SETTING_META,
  SettingKey,
} from './settings.constants';

export interface SettingCurrentValue {
  key: SettingKey;
  value: string;                 // Decimal als String (kein Precision-Verlust)
  effectiveFrom: string;         // ISO-Date YYYY-MM-DD
  effectiveTo: string | null;
  note: string | null;
  createdById: string | null;
  createdAt: string;             // ISO-Timestamp
}

export interface SettingHistoryEntry extends SettingCurrentValue {
  id: string;
  createdByName: string | null;
}

/**
 * Historisierter Settings-Service fuer die Gewinnanalyse.
 *
 * Kernregel: eine Aenderung heute darf einen alten Monat NIE veraendern.
 * Deshalb wird nicht "der aktuelle Wert" gespeichert sondern eine Periode
 * (effective_from, effective_to). Beim Setzen einer neuen Periode wird die
 * vorhergehende Periode automatisch abgeschlossen.
 *
 * Lookup: getValueAt(orgId, key, date) findet die Periode wo
 *   effective_from <= date  AND  (effective_to IS NULL OR effective_to >= date)
 * Wenn nichts gefunden wird -> Default aus SETTING_DEFAULTS + lazy in DB schreiben.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Gibt den fuer date_ gueltigen Wert zurueck.
   * Falls noch kein Datensatz existiert, wird der Default aus SETTING_DEFAULTS
   * lazy angelegt (effective_from = alter Anfangswert 2000-01-01, damit alle
   * Rueckrechnungen bedient sind).
   */
  async getValueAt(orgId: string, key: SettingKey, date: Date): Promise<string> {
    const dateOnly = this.toDateOnly(date);
    const row = await this.prisma.paSettingHistory.findFirst({
      where: {
        orgId,
        key,
        effectiveFrom: { lte: dateOnly },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: dateOnly } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (row) return row.value.toString();

    // Lazy Default
    const defaultValue = SETTING_DEFAULTS[key];
    if (defaultValue === undefined) {
      throw new NotFoundException(`Unbekannter Setting-Key: ${key}`);
    }
    await this.prisma.paSettingHistory.create({
      data: {
        orgId,
        key,
        value: new Prisma.Decimal(defaultValue),
        effectiveFrom: new Date('2000-01-01T00:00:00.000Z'),
        note: 'Automatisch angelegter Default beim ersten Lookup',
      },
    });
    return defaultValue;
  }

  /** Gibt den aktuell gueltigen Wert (fuer heute) zurueck. */
  async getCurrentValue(orgId: string, key: SettingKey): Promise<string> {
    return this.getValueAt(orgId, key, new Date());
  }

  /**
   * Liste aller aktuellen (heute gueltigen) Werte mit Metadaten fuer die UI.
   * Ideal fuer die Einstellungen-Seite.
   */
  async listCurrent(orgId: string): Promise<Array<{
    key: SettingKey;
    label: string;
    unit: 'percent' | 'eur';
    category: 'fees' | 'shipping' | 'vat';
    description: string;
    formula: string;
    currentValue: string;
    currentEffectiveFrom: string | null;
  }>> {
    const today = this.toDateOnly(new Date());
    const rows = await this.prisma.paSettingHistory.findMany({
      where: {
        orgId,
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      orderBy: [{ key: 'asc' }, { effectiveFrom: 'desc' }],
    });
    const byKey = new Map<string, typeof rows[number]>();
    for (const r of rows) {
      if (!byKey.has(r.key)) byKey.set(r.key, r); // ersten (neusten) pro Key
    }

    return SETTING_META.map((meta) => {
      const row = byKey.get(meta.key);
      return {
        key: meta.key,
        label: meta.label,
        unit: meta.unit,
        category: meta.category,
        description: meta.description,
        formula: meta.formula,
        currentValue: row ? row.value.toString() : SETTING_DEFAULTS[meta.key],
        currentEffectiveFrom: row ? this.formatDate(row.effectiveFrom) : null,
      };
    });
  }

  /**
   * Setzt einen neuen Wert ab effectiveFrom. Schliesst die aktuelle offene
   * Periode automatisch ab (effective_to := effectiveFrom - 1 Tag).
   *
   * Idempotent: wenn genau dieser Wert an genau diesem Datum bereits gesetzt
   * ist, wird nichts geaendert.
   */
  async setValue(
    orgId: string,
    key: SettingKey,
    newValue: string,
    effectiveFrom: Date,
    userId: string | null,
    note?: string,
  ): Promise<SettingCurrentValue> {
    if (!SETTING_DEFAULTS[key]) {
      throw new BadRequestException(`Unbekannter Setting-Key: ${key}`);
    }
    const parsed = this.parseValue(newValue);
    const effectiveFromDate = this.toDateOnly(effectiveFrom);
    const yesterday = new Date(effectiveFromDate.getTime() - 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      // Idempotenz-Check
      const existing = await tx.paSettingHistory.findUnique({
        where: {
          orgId_key_effectiveFrom: {
            orgId,
            key,
            effectiveFrom: effectiveFromDate,
          },
        },
      });
      if (existing && existing.value.toString() === parsed.toString()) {
        return this.toApi(existing);
      }

      // Vorgaenger-Periode schliessen: alle offenen Datensaetze mit
      // effective_from < neuem effective_from bekommen effective_to := yesterday.
      await tx.paSettingHistory.updateMany({
        where: {
          orgId,
          key,
          effectiveFrom: { lt: effectiveFromDate },
          effectiveTo: null,
        },
        data: { effectiveTo: yesterday },
      });

      // Falls fuer dasselbe effective_from schon ein Wert existiert -> updaten,
      // sonst neu anlegen.
      const upserted = existing
        ? await tx.paSettingHistory.update({
            where: { id: existing.id },
            data: {
              value: parsed,
              note: note ?? existing.note,
              createdById: userId ?? existing.createdById,
            },
          })
        : await tx.paSettingHistory.create({
            data: {
              orgId,
              key,
              value: parsed,
              effectiveFrom: effectiveFromDate,
              note: note ?? null,
              createdById: userId,
            },
          });

      return this.toApi(upserted);
    });
  }

  /** Volle Historie eines Keys mit Ersteller-Namen fuer die UI-Timeline. */
  async history(orgId: string, key: SettingKey): Promise<SettingHistoryEntry[]> {
    const rows = await this.prisma.paSettingHistory.findMany({
      where: { orgId, key },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        createdBy: { select: { name: true, firstName: true, lastName: true } },
      },
    });
    return rows.map((r) => ({
      ...this.toApi(r),
      id: r.id,
      createdByName: r.createdBy
        ? r.createdBy.name || `${r.createdBy.firstName ?? ''} ${r.createdBy.lastName ?? ''}`.trim() || null
        : null,
    }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Parst "3,5" oder "3.5" -> Decimal(3.5), rejects Nonsense. */
  private parseValue(input: string): Prisma.Decimal {
    if (typeof input !== 'string') throw new BadRequestException('Wert muss ein String sein');
    const normalized = input.trim().replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
      throw new BadRequestException(`Ungueltiger Zahlenwert: "${input}"`);
    }
    return new Prisma.Decimal(normalized);
  }

  /** Datum ohne Zeitanteil (UTC-Mitternacht) — wichtig fuer @db.Date-Vergleiche. */
  private toDateOnly(d: Date): Date {
    const iso = d.toISOString().slice(0, 10);
    return new Date(iso + 'T00:00:00.000Z');
  }

  private formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  private toApi(row: {
    key: string;
    value: Prisma.Decimal;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    note: string | null;
    createdById: string | null;
    createdAt: Date;
  }): SettingCurrentValue {
    return {
      key: row.key as SettingKey,
      value: row.value.toString(),
      effectiveFrom: this.formatDate(row.effectiveFrom),
      effectiveTo: row.effectiveTo ? this.formatDate(row.effectiveTo) : null,
      note: row.note,
      createdById: row.createdById,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
