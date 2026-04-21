import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export interface EmailSettingsInput {
  fromName?: string | null;
  fromEmail?: string | null;
  replyTo?: string | null;
  sendingDomain?: string | null;
  defaultConsentMode?: 'subscribed' | 'confirmed' | 'all_opted_in';
  doubleOptInEnabled?: boolean;
  maxEmailsPerContactPerDay?: number;
  unsubscribeCopy?: string | null;
  footerHtml?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class EmailSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get existing settings or create defaults on first call.
   * Generates publicTrackingKey + tokenSecret once (never regenerated unless
   * explicitly requested — would invalidate existing tracking installations).
   */
  async getOrCreate(orgId: string) {
    let settings = await this.prisma.emailSettings.findUnique({ where: { orgId } });
    if (settings) return this.redact(settings);

    settings = await this.prisma.emailSettings.create({
      data: {
        orgId,
        sendingDomain: 'mail.filapen.de',
        fromEmail: 'marketing@mail.filapen.de',
        fromName: 'Filapen',
        defaultConsentMode: 'subscribed',
        doubleOptInEnabled: true,
        maxEmailsPerContactPerDay: 3,
        publicTrackingKey: this.genKey(),
        tokenSecret: this.genSecret(),
      },
    });
    return this.redact(settings);
  }

  async update(orgId: string, data: EmailSettingsInput) {
    if (data.fromEmail && !EMAIL_RE.test(data.fromEmail)) {
      throw new BadRequestException('Ungültige From-E-Mail');
    }
    if (data.replyTo && !EMAIL_RE.test(data.replyTo)) {
      throw new BadRequestException('Ungültige Reply-To-E-Mail');
    }
    if (data.maxEmailsPerContactPerDay != null && data.maxEmailsPerContactPerDay < 0) {
      throw new BadRequestException('Frequency-Cap darf nicht negativ sein');
    }

    await this.getOrCreate(orgId); // ensure exists
    const updated = await this.prisma.emailSettings.update({
      where: { orgId },
      data: {
        ...(data.fromName !== undefined && { fromName: data.fromName?.trim() || null }),
        ...(data.fromEmail !== undefined && { fromEmail: data.fromEmail?.trim().toLowerCase() || null }),
        ...(data.replyTo !== undefined && { replyTo: data.replyTo?.trim().toLowerCase() || null }),
        ...(data.sendingDomain !== undefined && { sendingDomain: data.sendingDomain?.trim().toLowerCase() || null }),
        ...(data.defaultConsentMode !== undefined && { defaultConsentMode: data.defaultConsentMode }),
        ...(data.doubleOptInEnabled !== undefined && { doubleOptInEnabled: data.doubleOptInEnabled }),
        ...(data.maxEmailsPerContactPerDay !== undefined && { maxEmailsPerContactPerDay: data.maxEmailsPerContactPerDay }),
        ...(data.unsubscribeCopy !== undefined && { unsubscribeCopy: data.unsubscribeCopy }),
        ...(data.footerHtml !== undefined && { footerHtml: data.footerHtml }),
      },
    });
    return this.redact(updated);
  }

  /** Resolve settings by the public tracking key (no auth required). */
  async findByTrackingKey(key: string) {
    if (!key || key.length < 16) return null;
    return this.prisma.emailSettings.findFirst({ where: { publicTrackingKey: key } });
  }

  /** Rotate tracking key — invalidates installed snippets. Use with care. */
  async rotateTrackingKey(orgId: string) {
    await this.getOrCreate(orgId);
    const updated = await this.prisma.emailSettings.update({
      where: { orgId },
      data: { publicTrackingKey: this.genKey() },
    });
    return this.redact(updated);
  }

  private genKey(): string {
    return 'fp_' + crypto.randomBytes(24).toString('base64url');
  }

  private genSecret(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /** Strip internal secrets from returned settings. */
  private redact(s: any) {
    if (!s) return s;
    const { tokenSecret, ...rest } = s;
    return rest;
  }
}
