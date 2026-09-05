import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, PaOverheadRecurrence } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OVERHEAD_CATEGORIES } from './domain/overhead';

export type OverheadRecurrence = 'none' | 'monthly' | 'quarterly' | 'yearly';

export interface OverheadTemplateInput {
  category: string;
  label: string;
  amount: string;
  isGross: boolean;
  vatRate: string;
  active?: boolean;
}

export interface OverheadEntryInputDto {
  category: string;
  label: string;
  enteredAmount: string;
  isGross: boolean;
  vatRate: string;
  note?: string;
  recurrence?: OverheadRecurrence;
}

@Injectable()
export class OverheadService {
  constructor(private readonly prisma: PrismaService) {}

  categories() {
    return OVERHEAD_CATEGORIES;
  }

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  async listTemplates(orgId: string) {
    return this.prisma.paOverheadTemplate.findMany({
      where: { orgId },
      orderBy: [{ active: 'desc' }, { category: 'asc' }, { label: 'asc' }],
    });
  }

  async createTemplate(orgId: string, input: OverheadTemplateInput) {
    return this.prisma.paOverheadTemplate.create({
      data: {
        orgId,
        category: input.category,
        label: input.label.trim(),
        amount: this.dec(input.amount, 'amount'),
        isGross: input.isGross,
        vatRate: this.dec(input.vatRate, 'vatRate'),
        active: input.active ?? true,
      },
    });
  }

  async updateTemplate(orgId: string, id: string, input: Partial<OverheadTemplateInput>) {
    const existing = await this.prisma.paOverheadTemplate.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Vorlage nicht gefunden');
    return this.prisma.paOverheadTemplate.update({
      where: { id },
      data: {
        ...(input.category !== undefined && { category: input.category }),
        ...(input.label    !== undefined && { label: input.label.trim() }),
        ...(input.amount   !== undefined && { amount: this.dec(input.amount, 'amount') }),
        ...(input.isGross  !== undefined && { isGross: input.isGross }),
        ...(input.vatRate  !== undefined && { vatRate: this.dec(input.vatRate, 'vatRate') }),
        ...(input.active   !== undefined && { active: input.active }),
      },
    });
  }

  async deleteTemplate(orgId: string, id: string) {
    const existing = await this.prisma.paOverheadTemplate.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Vorlage nicht gefunden');
    await this.prisma.paOverheadTemplate.delete({ where: { id } });
    return { ok: true };
  }

  // ---------------------------------------------------------------------------
  // Entries pro Monat
  // ---------------------------------------------------------------------------

  async listEntries(orgId: string, year: number, month: number) {
    // Zuerst: wiederkehrende Entries aus frueheren Monaten in DIESEN Monat
    // materialisieren, falls das noch nie gemacht wurde. Danach normal listen.
    const monthRow = await this.getOrCreateMonth(orgId, year, month);
    await this.materializeRecurrencesIfNeeded(orgId, monthRow.id, year, month);
    const entries = await this.prisma.paOverheadEntry.findMany({
      where: { orgId, monthId: monthRow.id },
      orderBy: [{ category: 'asc' }, { label: 'asc' }],
    });
    return {
      entries: entries.map((e) => ({
        id: e.id,
        category: e.category,
        label: e.label,
        enteredAmount: e.enteredAmount.toString(),
        isGross: e.isGross,
        vatRate: e.vatRate.toString(),
        note: e.note,
        templateId: e.templateId,
        recurrence: e.recurrence as OverheadRecurrence,
        sourceEntryId: e.sourceEntryId,
      })),
    };
  }

  async createEntry(orgId: string, year: number, month: number, input: OverheadEntryInputDto) {
    const monthRow = await this.getOrCreateMonth(orgId, year, month);
    const created = await this.prisma.paOverheadEntry.create({
      data: {
        orgId, monthId: monthRow.id,
        category: input.category,
        label: input.label.trim(),
        enteredAmount: this.dec(input.enteredAmount, 'enteredAmount'),
        isGross: input.isGross,
        vatRate: this.dec(input.vatRate, 'vatRate'),
        note: input.note?.trim() || null,
        recurrence: (input.recurrence ?? 'none') as PaOverheadRecurrence,
      },
    });
    return created;
  }

  async updateEntry(orgId: string, id: string, input: Partial<OverheadEntryInputDto>) {
    const existing = await this.prisma.paOverheadEntry.findFirst({ where: { id, orgId } });
    if (!existing) throw new NotFoundException('Kostenposition nicht gefunden');
    return this.prisma.paOverheadEntry.update({
      where: { id },
      data: {
        ...(input.category      !== undefined && { category: input.category }),
        ...(input.label         !== undefined && { label: input.label.trim() }),
        ...(input.enteredAmount !== undefined && { enteredAmount: this.dec(input.enteredAmount, 'enteredAmount') }),
        ...(input.isGross       !== undefined && { isGross: input.isGross }),
        ...(input.vatRate       !== undefined && { vatRate: this.dec(input.vatRate, 'vatRate') }),
        ...(input.note          !== undefined && { note: input.note?.trim() || null }),
        ...(input.recurrence    !== undefined && { recurrence: input.recurrence as PaOverheadRecurrence }),
      },
    });
  }

  async deleteEntry(orgId: string, id: string) {
    const existing = await this.prisma.paOverheadEntry.findFirst({ where: { id, orgId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Kostenposition nicht gefunden');
    await this.prisma.paOverheadEntry.delete({ where: { id } });
    return { ok: true };
  }

  /**
   * Uebernimmt alle aktiven Templates in einen Monat, falls fuer diesen Monat
   * noch keine Eintraege existieren. Idempotent — mehrmaliger Aufruf tut nichts.
   */
  async applyTemplatesToMonth(orgId: string, year: number, month: number) {
    const monthRow = await this.getOrCreateMonth(orgId, year, month);
    const existing = await this.prisma.paOverheadEntry.count({
      where: { orgId, monthId: monthRow.id, templateId: { not: null } },
    });
    if (existing > 0) return { skipped: true, count: existing };

    const templates = await this.prisma.paOverheadTemplate.findMany({
      where: { orgId, active: true },
    });
    if (templates.length === 0) return { created: 0 };

    await this.prisma.paOverheadEntry.createMany({
      data: templates.map((t) => ({
        orgId, monthId: monthRow.id,
        category: t.category,
        label: t.label,
        enteredAmount: t.amount,
        isGross: t.isGross,
        vatRate: t.vatRate,
        templateId: t.id,
      })),
    });
    return { created: templates.length };
  }

  async getEntriesForMonth(orgId: string, monthId: string) {
    return this.prisma.paOverheadEntry.findMany({ where: { orgId, monthId } });
  }

  /**
   * Materialisiert wiederkehrende Origin-Entries in einen Zielmonat.
   *
   * Idempotenz-Schutz: laeuft nur EINMAL pro Monat (pa_month.
   * recurrenceMaterializedAt wird nach dem Durchlauf gesetzt). So kann
   * Master Wiederkehr-Kopien loeschen ohne dass sie beim naechsten
   * listEntries wieder erscheinen.
   *
   * Origin-Erkennung: Entries mit recurrence != 'none' aus JEDEM
   * frueheren Monat der Org werden geprueft:
   *   - monthly:   in jedem folgenden Monat
   *   - quarterly: in Monaten deren (originOffset % 3 === 0)
   *   - yearly:    in Monaten deren (originOffset % 12 === 0)
   * Wo originOffset = (targetYear*12 + targetMonth) − (originYear*12 + originMonth)
   *
   * Nur Origins bei denen dies der 1. materialisierte Zielmonat waere
   * (also noch keine Kopie mit sourceEntryId=origin.id in einem Monat
   * zwischen origin und target existiert) werden dupliziert — sonst
   * hatten wir bei einer 3-Monats-Luecke einen fehlenden Zwischenmonat
   * doppelt.
   */
  async materializeRecurrencesIfNeeded(orgId: string, monthId: string, year: number, month: number) {
    const monthRow = await this.prisma.paMonth.findUnique({
      where: { id: monthId },
      select: { recurrenceMaterializedAt: true },
    });
    if (monthRow?.recurrenceMaterializedAt) return { skipped: true };

    const targetOffset = year * 12 + month;

    // Alle Origin-Entries der Org (recurrence != none), sortiert nach Monatsdatum
    const origins = await this.prisma.paOverheadEntry.findMany({
      where: {
        orgId,
        recurrence: { not: 'none' as PaOverheadRecurrence },
      },
      include: { month: { select: { year: true, month: true } } },
    });

    const toCreate: Prisma.PaOverheadEntryCreateManyInput[] = [];

    for (const origin of origins) {
      const originOffset = origin.month.year * 12 + origin.month.month;
      const delta = targetOffset - originOffset;
      if (delta <= 0) continue; // Origin liegt in Zukunft oder gleich → keine Materialisierung

      // Muster-Match
      const matches =
        (origin.recurrence === 'monthly'   && delta >= 1) ||
        (origin.recurrence === 'quarterly' && delta % 3 === 0) ||
        (origin.recurrence === 'yearly'    && delta % 12 === 0);
      if (!matches) continue;

      // Skip wenn im Zielmonat bereits eine Kopie fuer diesen Origin existiert
      const existing = await this.prisma.paOverheadEntry.findFirst({
        where: { orgId, monthId, sourceEntryId: origin.id },
        select: { id: true },
      });
      if (existing) continue;

      toCreate.push({
        orgId,
        monthId,
        category: origin.category,
        label: origin.label,
        enteredAmount: origin.enteredAmount,
        isGross: origin.isGross,
        vatRate: origin.vatRate,
        note: origin.note,
        // recurrence auf 'none' — die Kopie ist eigenstaendig, nicht wieder
        // Ausgangspunkt einer neuen Kette. Master aendert das Original im
        // Ursprungsmonat, wenn er das Muster aendern will.
        recurrence: 'none' as PaOverheadRecurrence,
        sourceEntryId: origin.id,
      });
    }

    if (toCreate.length > 0) {
      await this.prisma.paOverheadEntry.createMany({ data: toCreate });
    }
    // Flag setzen — auch wenn 0 erzeugt wurden, sonst laeuft die Query beim naechsten GET erneut
    await this.prisma.paMonth.update({
      where: { id: monthId },
      data: { recurrenceMaterializedAt: new Date() },
    });
    return { created: toCreate.length };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async getOrCreateMonth(orgId: string, year: number, month: number) {
    return this.prisma.paMonth.upsert({
      where: { orgId_year_month: { orgId, year, month } },
      create: { orgId, year, month },
      update: {},
    });
  }

  private dec(s: string, field: string): Prisma.Decimal {
    if (typeof s !== 'string') throw new BadRequestException(`${field} muss String sein`);
    const norm = s.trim().replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(norm)) throw new BadRequestException(`${field}: ungueltig`);
    return new Prisma.Decimal(norm);
  }
}
