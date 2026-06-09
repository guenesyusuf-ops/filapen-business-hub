import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { InvoiceService } from './invoice.service';
import { InvoiceSettingsService } from './invoice-settings.service';

@Injectable()
export class InvoiceReminderService {
  private readonly logger = new Logger(InvoiceReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
    private readonly invoices: InvoiceService,
    private readonly settings: InvoiceSettingsService,
  ) {}

  /**
   * Taeglich um 07:30 — fuer jede Org:
   *  1. Status aller offenen Rechnungen neu berechnen
   *  2. Pro Settings-konfiguriertem Tag (z.B. 7, 3, 0, -1) Rechnungen finden,
   *     deren dueDate genau in dieser Anzahl Tage liegt, und Mail rausschicken
   *
   * Wir verhindern Doppel-Mails durch Logging in InvoiceEvent: pro Tag pro
   * Rechnung pro days-Schwelle nur einmal.
   */
  @Cron('30 7 * * *')
  async runDaily() {
    const orgs = await this.prisma.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      try {
        await this.runForOrg(org.id);
      } catch (err: any) {
        this.logger.error(`[orgId=${org.id}] reminder error: ${err?.message}`);
      }
    }
  }

  async runForOrg(orgId: string) {
    // 1. Status refresh
    await this.invoices.refreshStatuses(orgId);

    // 2. Settings holen
    const settings = await this.settings.getOrCreate(orgId);
    if (!settings.reminderDaysBefore?.length) return;

    // 3. Empfaenger-Adressen sammeln (Uploader + reminderRecipients)
    const additionalRecipients = settings.reminderRecipients ?? [];

    // 4. Pro Tag-Schwelle: Rechnungen finden
    const today = startOfDay(new Date());

    for (const days of settings.reminderDaysBefore) {
      // dueDate = today + days
      const target = new Date(today);
      target.setDate(target.getDate() + days);
      const next = new Date(target);
      next.setDate(next.getDate() + 1);

      const invoices = await this.prisma.invoice.findMany({
        where: {
          orgId,
          archived: false,
          paidAt: null,
          dueDate: { gte: target, lt: next },
        },
        include: { events: { where: { type: 'reminder_sent' }, select: { metadata: true } } },
      });

      for (const inv of invoices) {
        // Bereits fuer diese Schwelle benachrichtigt?
        const already = inv.events.some((e) => (e.metadata as any)?.days === days);
        if (already) continue;

        // Empfaenger zusammenstellen
        const recipients = new Set<string>(additionalRecipients);
        if (inv.uploadedById) {
          const u = await this.prisma.user.findUnique({
            where: { id: inv.uploadedById },
            select: { email: true },
          });
          if (u?.email) recipients.add(u.email);
        }
        if (recipients.size === 0) continue;

        const detailLink = this.config.get<string>('APP_URL', 'https://app.filapen.com') + `/invoices/${inv.id}`;
        let sent = 0;
        for (const to of recipients) {
          const ok = await this.email.sendInvoiceReminder({
            to,
            supplierName: inv.supplierName ?? 'Unbekannter Lieferant',
            invoiceNumber: inv.invoiceNumber ?? '—',
            grossAmount: this.formatEUR(inv.grossAmount),
            dueDate: inv.dueDate!.toLocaleDateString('de-DE'),
            daysUntilDue: days,
            detailLink,
          });
          if (ok) sent++;
        }
        await this.prisma.invoiceEvent.create({
          data: {
            orgId,
            invoiceId: inv.id,
            type: 'reminder_sent',
            note: `Erinnerung (${days >= 0 ? `${days} Tage vor` : `${-days} Tage nach`} Fälligkeit) an ${sent} Empfänger`,
            metadata: { days, recipients: Array.from(recipients), sent },
          },
        });
      }
    }
  }

  private formatEUR(d: any): string {
    if (d == null) return '—';
    const n = typeof d === 'string' ? Number(d) : Number(d.toString());
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
