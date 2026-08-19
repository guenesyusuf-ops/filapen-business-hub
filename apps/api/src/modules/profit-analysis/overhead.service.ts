import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { OVERHEAD_CATEGORIES } from './domain/overhead';

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
    const monthRow = await this.prisma.paMonth.findUnique({
      where: { orgId_year_month: { orgId, year, month } },
    });
    if (!monthRow) return { entries: [] };
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
