import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../../common/email/email.service';
import { NfcService } from './nfc.service';

const INACTIVITY_MONTHS = 24;     // 24 Monate ohne Edit → Reminder
const DELETION_DAYS_AFTER_REMINDER = 30; // 30 Tage nach Reminder → auto-Loeschung

@Injectable()
export class NfcCronService {
  private readonly logger = new Logger(NfcCronService.name);
  private readonly publicBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly nfc: NfcService,
    private readonly config: ConfigService,
  ) {
    this.publicBaseUrl = (this.config.get<string>('NFC_PUBLIC_URL') ?? 'https://nfc4you.de').replace(/\/$/, '');
  }

  /**
   * Taeglich um 03:30 — DSGVO-Auto-Cleanup:
   *  Schritt 1: Activations mit updatedAt < heute-24Monate UND noch kein Reminder
   *             → Reminder-Mail an Email (wenn vorhanden), inactivityReminderSentAt setzen
   *  Schritt 2: Activations mit inactivityReminderSentAt < heute-30Tage
   *             → Daten loeschen + Band-Status auf 'deleted'
   *  Schritt 3: Ablauf-getriggertes Loeschen von abgelaufenen PIN-Reset-Tokens
   */
  @Cron('30 3 * * *')
  async runDaily() {
    this.logger.log('[NfcCron] Daily run started');
    await this.sendInactivityReminders();
    await this.autoDeleteExpired();
    await this.cleanupExpiredResetTokens();
    this.logger.log('[NfcCron] Daily run finished');
  }

  // -------------------------------------------------------------------
  // 1) Inaktivitaets-Reminder
  // -------------------------------------------------------------------
  private async sendInactivityReminders() {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - INACTIVITY_MONTHS);

    const candidates = await this.prisma.nfcActivation.findMany({
      where: {
        updatedAt: { lt: cutoff },
        inactivityReminderSentAt: null,
      },
      take: 200,
      include: { band: { select: { code: true } } },
    });

    let sent = 0;
    let skipped = 0;
    for (const a of candidates) {
      if (!a.email) {
        // Keine E-Mail → wir koennen nicht erinnern, also direkt "Reminder" markieren
        // damit die 30-Tage-Frist startet. Sonst stecken die Datensaetze fest.
        await this.prisma.nfcActivation.update({
          where: { id: a.id },
          data: { inactivityReminderSentAt: new Date() },
        });
        skipped++;
        continue;
      }
      const profileLink = `${this.publicBaseUrl}/${a.band.code}`;
      const ok = await this.email.sendNfcInactivityReminder({
        to: a.email,
        code: a.band.code,
        profileLink,
      });
      await this.prisma.nfcActivation.update({
        where: { id: a.id },
        data: { inactivityReminderSentAt: new Date() },
      });
      await this.nfc.audit(a.orgId, a.bandId, null, 'auto_reminder', { emailSent: ok });
      if (ok) sent++;
    }
    if (candidates.length > 0) {
      this.logger.log(`[NfcCron] Inactivity reminders: ${sent} gesendet, ${skipped} ohne Email`);
    }
  }

  // -------------------------------------------------------------------
  // 2) Auto-Delete nach 30 Tagen nach Reminder
  // -------------------------------------------------------------------
  private async autoDeleteExpired() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DELETION_DAYS_AFTER_REMINDER);

    const expired = await this.prisma.nfcActivation.findMany({
      where: {
        inactivityReminderSentAt: { lt: cutoff },
      },
      take: 100,
      select: { id: true, bandId: true, orgId: true },
    });

    for (const a of expired) {
      try {
        await this.prisma.$transaction([
          this.prisma.nfcActivation.delete({ where: { id: a.id } }),
          this.prisma.nfcBand.update({
            where: { id: a.bandId },
            data: { status: 'deleted' },
          }),
        ]);
        await this.nfc.audit(a.orgId, a.bandId, null, 'auto_delete', { reason: 'inactivity-24mo' });
      } catch (err: any) {
        this.logger.error(`[NfcCron] Auto-Delete failed for ${a.id}: ${err?.message}`);
      }
    }
    if (expired.length > 0) {
      this.logger.log(`[NfcCron] Auto-deleted ${expired.length} expired activations`);
    }
  }

  // -------------------------------------------------------------------
  // 3) Abgelaufene PIN-Reset-Tokens entfernen
  // -------------------------------------------------------------------
  private async cleanupExpiredResetTokens() {
    const res = await this.prisma.nfcActivation.updateMany({
      where: {
        pinResetTokenExpiresAt: { lt: new Date() },
      },
      data: {
        pinResetTokenHash: null,
        pinResetTokenExpiresAt: null,
      },
    });
    if (res.count > 0) {
      this.logger.log(`[NfcCron] Cleaned ${res.count} expired PIN-Reset-Tokens`);
    }
  }
}
