import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_REMINDER_DAYS = [7, 3, 0]; // 7d/3d/Tag-X

@Injectable()
export class InvoiceSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Lazy upsert — wenn noch keine Settings existieren, mit Defaults anlegen. */
  async getOrCreate(orgId: string) {
    const existing = await this.prisma.invoiceSettings.findUnique({ where: { orgId } });
    if (existing) return existing;
    return this.prisma.invoiceSettings.create({
      data: { orgId, reminderDaysBefore: DEFAULT_REMINDER_DAYS },
    });
  }

  async update(orgId: string, body: {
    reminderDaysBefore?: number[];
    reminderRecipients?: string[];
    defaultCategory?: string;
    retentionMonths?: number;
    customCategories?: string[];
  }) {
    await this.getOrCreate(orgId);
    const data: any = {};
    if (Array.isArray(body.reminderDaysBefore)) {
      data.reminderDaysBefore = body.reminderDaysBefore
        .map((n) => Math.floor(Number(n)))
        .filter((n) => Number.isFinite(n));
    }
    if (Array.isArray(body.reminderRecipients)) {
      data.reminderRecipients = body.reminderRecipients
        .map((s) => String(s).trim())
        .filter((s) => /.+@.+/.test(s));
    }
    if (typeof body.defaultCategory === 'string') data.defaultCategory = body.defaultCategory.trim() || 'other';
    if (Number.isFinite(body.retentionMonths)) data.retentionMonths = Math.max(12, Math.floor(Number(body.retentionMonths)));
    if (Array.isArray(body.customCategories)) {
      data.customCategories = body.customCategories.map((s) => String(s).trim()).filter(Boolean);
    }
    return this.prisma.invoiceSettings.update({ where: { orgId }, data });
  }
}
