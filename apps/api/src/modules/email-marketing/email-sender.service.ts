import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailRenderingService } from './email-rendering.service';
import { TrackingTokenService } from './tracking-token.service';
import { MarketingEventService } from './marketing-event.service';

export interface SendJob {
  orgId: string;
  contactId: string;
  templateId?: string;
  campaignId?: string;
  flowId?: string;
  flowStepId?: string;
  /** Override subject / blocks if template not used */
  subject?: string;
  blocks?: any;
  htmlOverride?: string | null;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string | null;
  /** Extra vars passed to renderer */
  extra?: Record<string, any>;
  /** Consent mode: 'subscribed' | 'confirmed' | 'all_opted_in' */
  consentMode?: string;
}

export type SendResult =
  | { status: 'sent'; messageId: string; providerId?: string }
  | { status: 'suppressed'; messageId: string; reason: string }
  | { status: 'skipped'; reason: string };

@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);
  private readonly apiUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly renderer: EmailRenderingService,
    private readonly tokens: TrackingTokenService,
    private readonly events: MarketingEventService,
  ) {
    this.apiUrl = this.config.get<string>('API_URL') || 'https://filapenapi-production.up.railway.app';
  }

  /**
   * Send a single email. Performs all preflight checks, renders, injects
   * tracking, sends via Resend, and logs the EmailMessage. Idempotent:
   * re-calling with the same (campaignId, contactId) pair won't duplicate.
   */
  async send(job: SendJob): Promise<SendResult> {
    const contact = await this.prisma.contact.findFirst({
      where: { id: job.contactId, orgId: job.orgId },
    });
    if (!contact) return { status: 'skipped', reason: 'contact_not_found' };
    if (!contact.email) return { status: 'skipped', reason: 'no_email' };

    // Consent check
    const consentMode = job.consentMode || 'subscribed';
    const allowed = this.consentAllows(contact.marketingConsent, consentMode);
    if (!allowed) {
      return { status: 'skipped', reason: `consent_not_met:${contact.marketingConsent}` };
    }

    // Suppression check
    const suppressed = await this.prisma.emailSuppression.findFirst({
      where: { orgId: job.orgId, email: contact.email },
    });
    if (suppressed) {
      return { status: 'skipped', reason: `suppressed:${suppressed.reason}` };
    }

    // Frequency cap check
    const settings = await this.prisma.emailSettings.findUnique({ where: { orgId: job.orgId } });
    if (!settings?.fromEmail || !settings?.fromName) {
      return { status: 'skipped', reason: 'settings_incomplete' };
    }
    const cap = settings.maxEmailsPerContactPerDay;
    if (cap > 0) {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recent = await this.prisma.emailMessage.count({
        where: { orgId: job.orgId, contactId: contact.id, sentAt: { gte: since } },
      });
      if (recent >= cap) {
        return { status: 'skipped', reason: 'frequency_cap' };
      }
    }

    // Dedupe per campaign (don't send same campaign to same contact twice)
    if (job.campaignId) {
      const existing = await this.prisma.emailMessage.findFirst({
        where: { orgId: job.orgId, contactId: contact.id, campaignId: job.campaignId, status: { not: 'failed' } },
      });
      if (existing) return { status: 'skipped', reason: 'already_sent_this_campaign' };
    }

    // Load template if referenced
    let subject = job.subject || '';
    let blocks: any = job.blocks;
    let htmlOverride: string | null = job.htmlOverride ?? null;
    let previewText: string | null = null;
    if (job.templateId) {
      const tpl = await this.prisma.emailTemplate.findFirst({
        where: { id: job.templateId, orgId: job.orgId },
      });
      if (!tpl) return { status: 'skipped', reason: 'template_not_found' };
      subject = tpl.subject;
      blocks = tpl.blocks;
      htmlOverride = tpl.htmlOverride;
      previewText = tpl.previewText;
    }
    if (!subject) return { status: 'skipped', reason: 'no_subject' };

    const fromName = job.fromName || settings.fromName;
    const fromEmail = job.fromEmail || settings.fromEmail;
    const replyTo = job.replyTo || settings.replyTo || undefined;
    const tokenSecret = settings.tokenSecret || 'fallback-secret-must-be-rotated';

    // Create EmailMessage first so tracking URLs can reference its id
    const message = await this.prisma.emailMessage.create({
      data: {
        orgId: job.orgId,
        contactId: contact.id,
        campaignId: job.campaignId || null,
        flowId: job.flowId || null,
        flowStepId: job.flowStepId || null,
        subject: subject.slice(0, 500),
        fromEmail,
        toEmail: contact.email,
        status: 'queued',
      },
    });

    // Build tracking URLs
    const pixelToken = this.tokens.sign({ m: message.id, t: 'open' }, tokenSecret);
    const pixelUrl = `${this.apiUrl}/api/track/e/open?m=${message.id}&t=${encodeURIComponent(pixelToken)}`;

    const unsubToken = this.tokens.sign({ m: message.id, c: contact.id, o: job.orgId, t: 'unsub' }, tokenSecret);
    const unsubscribeUrl = `${this.apiUrl}/api/track/e/unsubscribe?m=${message.id}&t=${encodeURIComponent(unsubToken)}`;

    const clickUrlBuilder = (originalUrl: string) => {
      const token = this.tokens.sign({ m: message.id, u: originalUrl, t: 'click' }, tokenSecret);
      return `${this.apiUrl}/api/track/e/click?m=${message.id}&t=${encodeURIComponent(token)}`;
    };

    // Render
    const { html: bodyHtml, text } = this.renderer.render({
      subject,
      preheader: previewText || undefined,
      blocks,
      htmlOverride,
      context: {
        contact: {
          email: contact.email,
          firstName: contact.firstName,
          lastName: contact.lastName,
          tags: contact.tags,
        },
        unsubscribeUrl,
        fromName,
        footerHtml: settings.footerHtml,
        extra: job.extra,
      },
    });

    const html = this.renderer.addTracking(bodyHtml, { pixelUrl, clickUrlBuilder });

    // Send via Resend
    try {
      const providerId = await this.sendViaResend({
        from: `${fromName} <${fromEmail}>`,
        to: contact.email,
        subject,
        html,
        text,
        replyTo,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      });

      await this.prisma.emailMessage.update({
        where: { id: message.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          providerMessageId: providerId,
        },
      });

      this.events.record({
        orgId: job.orgId,
        contactId: contact.id,
        type: 'email_sent',
        source: 'email',
        externalId: `msg:${message.id}`,
        payload: { messageId: message.id, campaignId: job.campaignId, flowId: job.flowId },
      }).catch(() => {});

      return { status: 'sent', messageId: message.id, providerId };
    } catch (err: any) {
      this.logger.error(`Send failed for ${contact.email}: ${err?.message}`, err?.stack);
      await this.prisma.emailMessage.update({
        where: { id: message.id },
        data: { status: 'failed' },
      });
      return { status: 'suppressed', messageId: message.id, reason: `send_error:${err?.message}` };
    }
  }

  private consentAllows(contactConsent: string, mode: string): boolean {
    if (contactConsent === 'unsubscribed') return false;
    if (mode === 'confirmed') return contactConsent === 'confirmed';
    if (mode === 'subscribed') return contactConsent === 'subscribed' || contactConsent === 'confirmed';
    if (mode === 'all_opted_in') {
      return contactConsent === 'subscribed' || contactConsent === 'confirmed' || contactConsent === 'never_subscribed';
    }
    return contactConsent === 'subscribed' || contactConsent === 'confirmed';
  }

  private async sendViaResend(params: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
    headers?: Record<string, string>;
  }): Promise<string | undefined> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: params.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
        reply_to: params.replyTo,
        headers: params.headers,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend ${res.status}: ${body.slice(0, 500)}`);
    }
    const json = await res.json().catch(() => ({} as any));
    return json?.id;
  }
}
