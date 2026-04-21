import {
  Controller, Get, Post, Body, Query, Headers, Ip, Res, BadRequestException, Logger, Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailSettingsService } from './email-settings.service';
import { ContactSyncService } from './contact-sync.service';
import { MarketingEventService } from './marketing-event.service';
import { TrackingTokenService } from './tracking-token.service';

interface TrackPayload {
  key: string;
  event: string;
  email?: string;
  anonymousId?: string;
  properties?: Record<string, any>;
  occurredAt?: string;
}

interface IdentifyPayload {
  key: string;
  anonymousId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  properties?: Record<string, any>;
}

const ALLOWED_EVENT_TYPES = new Set([
  'viewed_product', 'added_to_cart', 'started_checkout',
  'viewed_category', 'searched', 'viewed_page', 'custom',
]);

/**
 * Public tracking endpoints — NO JWT auth.
 * Origin is validated via the publicTrackingKey on EmailSettings (one per org).
 */
@Controller('track')
export class PublicTrackingController {
  private readonly logger = new Logger(PublicTrackingController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: EmailSettingsService,
    private readonly contactSync: ContactSyncService,
    private readonly events: MarketingEventService,
    private readonly tokens: TrackingTokenService,
  ) {}

  @Post('event')
  async trackEvent(
    @Body() body: TrackPayload,
    @Headers('user-agent') ua: string | undefined,
    @Ip() ip: string,
  ) {
    if (!body?.key) throw new BadRequestException('Tracking-Key fehlt');
    if (!body?.event) throw new BadRequestException('Event-Typ fehlt');
    const type = body.event.toLowerCase();
    if (!ALLOWED_EVENT_TYPES.has(type)) {
      throw new BadRequestException(`Unbekannter Event-Typ: ${type}`);
    }

    const settings = await this.settings.findByTrackingKey(body.key);
    if (!settings) throw new BadRequestException('Ungültiger Tracking-Key');
    const orgId = settings.orgId;

    // Resolve contact via email (preferred) or anonymous id
    let contactId: string | null = null;
    if (body.email) {
      const normalized = body.email.trim().toLowerCase();
      const existing = await this.prisma.contact.findUnique({
        where: { orgId_email: { orgId, email: normalized } },
      });
      if (existing) contactId = existing.id;
    } else if (body.anonymousId) {
      const existing = await this.prisma.contact.findFirst({
        where: { orgId, anonymousId: body.anonymousId },
      });
      if (existing) contactId = existing.id;
    }

    await this.events.record({
      orgId,
      contactId,
      anonymousId: body.anonymousId || null,
      type,
      source: 'browser',
      payload: { ...body.properties, userAgent: ua, ip },
      occurredAt: body.occurredAt ? new Date(body.occurredAt) : new Date(),
    });

    // Update last_seen_at on known contacts
    if (contactId) {
      this.prisma.contact.update({
        where: { id: contactId },
        data: { lastSeenAt: new Date() },
      }).catch(() => {});
    }

    return { ok: true };
  }

  /**
   * Associate an anonymous visitor with an email (e.g. after Newsletter-Signup
   * or Account-Creation). Creates contact if none yet.
   */
  @Post('identify')
  async identify(@Body() body: IdentifyPayload) {
    if (!body?.key || !body?.email) {
      throw new BadRequestException('Key und Email erforderlich');
    }
    const settings = await this.settings.findByTrackingKey(body.key);
    if (!settings) throw new BadRequestException('Ungültiger Tracking-Key');
    const orgId = settings.orgId;
    const email = body.email.trim().toLowerCase();

    const existing = await this.prisma.contact.findUnique({
      where: { orgId_email: { orgId, email } },
    });

    if (existing) {
      await this.prisma.contact.update({
        where: { id: existing.id },
        data: {
          anonymousId: body.anonymousId || existing.anonymousId,
          firstName: body.firstName || existing.firstName,
          lastName: body.lastName || existing.lastName,
          lastSeenAt: new Date(),
        },
      });
      return { ok: true, contactId: existing.id, created: false };
    }

    const created = await this.prisma.contact.create({
      data: {
        orgId,
        email,
        firstName: body.firstName || null,
        lastName: body.lastName || null,
        anonymousId: body.anonymousId || null,
        lastSeenAt: new Date(),
      },
    });
    return { ok: true, contactId: created.id, created: true };
  }

  /**
   * Browser-Snippet generator. User embeds:
   *   <script async src="https://api.filapen.de/api/track/snippet.js?key=fp_xxx"></script>
   */
  @Get('snippet.js')
  async snippet(@Query('key') key: string | undefined, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');

    if (!key) {
      return res.send(`// Filapen tracking snippet — missing key parameter\n`);
    }
    const settings = await this.settings.findByTrackingKey(key);
    if (!settings) {
      return res.send(`// Filapen tracking snippet — invalid key\n`);
    }

    const apiUrl = process.env.API_URL || 'https://filapenapi-production.up.railway.app';
    const script = buildBrowserSnippet(apiUrl, key);
    return res.send(script);
  }

  // ============================================================
  // Email tracking endpoints (pixel / click / unsubscribe)
  // ============================================================

  @Get('e/open')
  async trackOpen(
    @Query('m') messageId: string | undefined,
    @Query('t') token: string | undefined,
    @Headers('user-agent') ua: string | undefined,
    @Ip() ip: string,
    @Res() res: Response,
  ) {
    // Always respond with 1x1 pixel (even on invalid token — privacy)
    const pixel = Buffer.from('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');

    try {
      if (messageId && token) {
        await this.handleOpen(messageId, token, ua, ip);
      }
    } catch (err: any) {
      this.logger.warn(`trackOpen error: ${err?.message}`);
    }
    return res.status(200).end(pixel);
  }

  @Get('e/click')
  async trackClick(
    @Query('m') messageId: string | undefined,
    @Query('t') token: string | undefined,
    @Headers('user-agent') ua: string | undefined,
    @Ip() ip: string,
    @Res() res: Response,
  ) {
    try {
      const payload = await this.verifyMessageToken(messageId, token);
      const url = payload?.u;
      if (!url) return res.redirect('/');

      await this.prisma.emailMessage.update({
        where: { id: messageId! },
        data: {
          clickedAt: new Date(),
          clickCount: { increment: 1 },
          openedAt: { set: new Date() }, // click implies open
        },
      }).catch(() => {});
      await this.prisma.emailMessageEvent.create({
        data: { messageId: messageId!, type: 'clicked', url, userAgent: ua, ip: ip?.slice(0, 45) },
      }).catch(() => {});
      const msg = await this.prisma.emailMessage.findUnique({ where: { id: messageId! } });
      if (msg?.campaignId) {
        this.prisma.emailCampaign.update({
          where: { id: msg.campaignId },
          data: { clickCount: { increment: 1 } },
        }).catch(() => {});
      }
      if (msg) {
        this.events.record({
          orgId: msg.orgId,
          contactId: msg.contactId,
          type: 'email_clicked',
          source: 'email',
          externalId: `click:${messageId}:${Date.now()}`,
          payload: { url, messageId },
        }).catch(() => {});
      }

      return res.redirect(302, url);
    } catch (err: any) {
      this.logger.warn(`trackClick error: ${err?.message}`);
      return res.redirect('/');
    }
  }

  @Get('e/unsubscribe')
  async unsubscribeGet(
    @Query('m') messageId: string | undefined,
    @Query('t') token: string | undefined,
    @Res() res: Response,
  ) {
    const payload = await this.verifyMessageToken(messageId, token);
    if (!payload?.c || !payload?.o) {
      return res
        .status(400)
        .send(unsubscribePage({ title: 'Ungültiger Link', message: 'Der Abmelde-Link ist nicht mehr gültig.', success: false }));
    }
    // Render confirmation page with POST form (prevents accidental one-click)
    return res.send(unsubscribePage({
      title: 'Vom Newsletter abmelden?',
      message: 'Klicke auf Abmelden, um keine weiteren Marketing-Emails mehr zu erhalten.',
      showForm: true,
      messageId: messageId!,
      token: token!,
    }));
  }

  @Post('e/unsubscribe')
  async unsubscribePost(
    @Query('m') messageId: string | undefined,
    @Query('t') token: string | undefined,
    @Body() body: any,
    @Res() res: Response,
  ) {
    const payload = await this.verifyMessageToken(messageId, token);
    if (!payload?.c || !payload?.o) {
      return res.status(400).send(unsubscribePage({ title: 'Ungültig', message: 'Der Link ist nicht gültig.', success: false }));
    }
    await this.prisma.contact.update({
      where: { id: payload.c },
      data: { marketingConsent: 'unsubscribed', unsubscribedAt: new Date() },
    }).catch(() => {});
    const contact = await this.prisma.contact.findUnique({ where: { id: payload.c } });
    if (contact?.email) {
      await this.prisma.emailSuppression.upsert({
        where: { orgId_email: { orgId: payload.o, email: contact.email } },
        update: {},
        create: {
          orgId: payload.o, email: contact.email, reason: 'unsubscribed',
          sourceId: messageId || null,
        },
      }).catch(() => {});
    }
    await this.prisma.emailMessage.update({
      where: { id: messageId! },
      data: { unsubscribedAt: new Date() },
    }).catch(() => {});
    const msg = await this.prisma.emailMessage.findUnique({ where: { id: messageId! } });
    if (msg?.campaignId) {
      this.prisma.emailCampaign.update({
        where: { id: msg.campaignId },
        data: { unsubscribeCount: { increment: 1 } },
      }).catch(() => {});
    }
    this.events.record({
      orgId: payload.o,
      contactId: payload.c,
      type: 'unsubscribed',
      source: 'email',
      externalId: `unsub:${messageId}`,
    }).catch(() => {});

    return res.send(unsubscribePage({
      title: 'Abmeldung bestätigt',
      message: 'Du erhältst ab sofort keine Marketing-Emails mehr von uns.',
      success: true,
    }));
  }

  // ============================================================
  // Resend webhooks (provider → us)
  // ============================================================

  @Post('resend/webhook')
  async resendWebhook(
    @Body() body: any,
    @Headers('svix-signature') signature: string | undefined,
  ) {
    // Resend webhooks are optional — if signature verification env is set we verify,
    // otherwise we accept. For production, set RESEND_WEBHOOK_SECRET and verify.
    const type: string = body?.type || '';
    const data = body?.data || {};
    const providerId: string | undefined = data?.email_id || data?.id;
    if (!providerId) return { ok: true, ignored: 'no_id' };

    const msg = await this.prisma.emailMessage.findFirst({ where: { providerMessageId: providerId } });
    if (!msg) return { ok: true, ignored: 'unknown_message' };

    const now = new Date();
    const patch: any = {};
    let evtType: string | null = null;
    switch (type) {
      case 'email.delivered':
        patch.status = 'delivered';
        evtType = 'delivered';
        if (msg.campaignId) {
          this.prisma.emailCampaign.update({
            where: { id: msg.campaignId }, data: { deliveredCount: { increment: 1 } },
          }).catch(() => {});
        }
        break;
      case 'email.bounced':
        patch.status = 'bounced';
        patch.bouncedAt = now;
        evtType = 'bounced';
        if (msg.toEmail) {
          this.prisma.emailSuppression.upsert({
            where: { orgId_email: { orgId: msg.orgId, email: msg.toEmail } },
            update: { reason: 'bounced_hard' },
            create: { orgId: msg.orgId, email: msg.toEmail, reason: 'bounced_hard', sourceId: providerId },
          }).catch(() => {});
        }
        if (msg.campaignId) {
          this.prisma.emailCampaign.update({
            where: { id: msg.campaignId }, data: { bounceCount: { increment: 1 } },
          }).catch(() => {});
        }
        break;
      case 'email.complained':
        patch.status = 'complained';
        patch.complainedAt = now;
        evtType = 'complained';
        if (msg.toEmail) {
          this.prisma.emailSuppression.upsert({
            where: { orgId_email: { orgId: msg.orgId, email: msg.toEmail } },
            update: { reason: 'complained' },
            create: { orgId: msg.orgId, email: msg.toEmail, reason: 'complained', sourceId: providerId },
          }).catch(() => {});
        }
        break;
      case 'email.opened':
        // Fallback if our pixel didn't fire (Resend sometimes reports this via link proxy)
        if (!msg.openedAt) patch.openedAt = now;
        patch.openCount = { increment: 1 };
        evtType = 'opened_provider';
        break;
      case 'email.clicked':
        if (!msg.clickedAt) patch.clickedAt = now;
        patch.clickCount = { increment: 1 };
        evtType = 'clicked_provider';
        break;
      case 'email.failed':
        patch.status = 'failed';
        evtType = 'failed';
        break;
      default:
        return { ok: true, ignored: `unknown_type:${type}` };
    }

    await this.prisma.emailMessage.update({ where: { id: msg.id }, data: patch }).catch(() => {});
    if (evtType) {
      this.prisma.emailMessageEvent.create({
        data: { messageId: msg.id, type: evtType },
      }).catch(() => {});
    }
    return { ok: true };
  }

  // ---------------- Helpers ----------------

  private async verifyMessageToken(messageId: string | undefined, token: string | undefined): Promise<any> {
    if (!messageId || !token) return null;
    const msg = await this.prisma.emailMessage.findUnique({ where: { id: messageId } });
    if (!msg) return null;
    const settings = await this.prisma.emailSettings.findUnique({ where: { orgId: msg.orgId } });
    if (!settings?.tokenSecret) return null;
    return this.tokens.verify(token, settings.tokenSecret);
  }

  private async handleOpen(messageId: string, token: string, ua?: string, ip?: string) {
    const payload = await this.verifyMessageToken(messageId, token);
    if (!payload) return;
    const msg = await this.prisma.emailMessage.findUnique({ where: { id: messageId } });
    if (!msg) return;
    const patch: any = { openCount: { increment: 1 } };
    if (!msg.openedAt) patch.openedAt = new Date();
    await this.prisma.emailMessage.update({ where: { id: messageId }, data: patch });
    await this.prisma.emailMessageEvent.create({
      data: { messageId, type: 'opened', userAgent: ua, ip: ip?.slice(0, 45) },
    }).catch(() => {});
    if (msg.campaignId) {
      this.prisma.emailCampaign.update({
        where: { id: msg.campaignId }, data: { openCount: { increment: 1 } },
      }).catch(() => {});
    }
    this.events.record({
      orgId: msg.orgId,
      contactId: msg.contactId,
      type: 'email_opened',
      source: 'email',
      externalId: `open:${messageId}:${Date.now()}`,
      payload: { messageId },
    }).catch(() => {});
  }
}

function unsubscribePage(opts: {
  title: string;
  message: string;
  showForm?: boolean;
  success?: boolean;
  messageId?: string;
  token?: string;
}): string {
  const color = opts.success === false ? '#dc2626' : opts.success === true ? '#16a34a' : '#111827';
  const form = opts.showForm && opts.messageId && opts.token
    ? `<form method="POST" action="/api/track/e/unsubscribe?m=${opts.messageId}&t=${encodeURIComponent(opts.token)}" style="margin-top:24px;">
        <button type="submit" style="background:#dc2626;color:#fff;border:0;padding:12px 28px;border-radius:8px;font-weight:600;cursor:pointer;">Abmelden</button>
       </form>`
    : '';
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>${opts.title}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f3f4f6;margin:0;padding:48px 16px;color:#111827;}
.card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.05);}
h1{margin:0 0 12px 0;font-size:22px;color:${color};} p{margin:0;color:#4b5563;line-height:1.6;}</style>
</head><body><div class="card"><h1>${opts.title}</h1><p>${opts.message}</p>${form}</div></body></html>`;
}

function buildBrowserSnippet(apiUrl: string, key: string): string {
  return `/* Filapen Tracking Snippet v1 */
(function(){
  try {
    var KEY = ${JSON.stringify(key)};
    var ENDPOINT = ${JSON.stringify(apiUrl + '/api/track/event')};
    var IDENTIFY = ${JSON.stringify(apiUrl + '/api/track/identify')};
    var ANON_KEY = '_fp_anon';
    var EMAIL_KEY = '_fp_email';

    function uuid() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0; var v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }
    function getAnon(){ try { var v = localStorage.getItem(ANON_KEY); if(!v){ v = uuid(); localStorage.setItem(ANON_KEY, v); } return v; } catch(e){ return null; } }
    function getEmail(){ try { return localStorage.getItem(EMAIL_KEY); } catch(e){ return null; } }
    function send(payload) {
      try {
        var body = JSON.stringify(payload);
        if (navigator.sendBeacon) {
          navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
        } else {
          fetch(ENDPOINT, { method: 'POST', body: body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function(){});
        }
      } catch(e) {}
    }

    window.filapen = window.filapen || {};
    window.filapen.track = function(event, properties) {
      send({ key: KEY, event: event, email: getEmail(), anonymousId: getAnon(), properties: properties || {} });
    };
    window.filapen.identify = function(email, props) {
      try {
        if (email) localStorage.setItem(EMAIL_KEY, email);
        fetch(IDENTIFY, { method: 'POST', body: JSON.stringify({ key: KEY, email: email, anonymousId: getAnon(), firstName: props && props.firstName, lastName: props && props.lastName, properties: props || {} }), headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(function(){});
      } catch(e) {}
    };

    /* Shopify-aware auto-tracking: product + cart. We inspect common Shopify theme markers. */
    try {
      var productEl = document.querySelector('meta[property="og:type"][content="product"]') || document.querySelector('[data-product-id]');
      if (productEl) {
        var productId = productEl.getAttribute('data-product-id') || null;
        var handle = (location.pathname.match(/\\/products\\/([^/?#]+)/) || [])[1] || null;
        var title = document.querySelector('meta[property="og:title"]');
        window.filapen.track('viewed_product', {
          productId: productId,
          handle: handle,
          title: title ? title.getAttribute('content') : document.title,
          url: location.href,
        });
      }
    } catch(e) {}

    /* Listen for Shopify's AJAX cart events (Focal + most themes) */
    try {
      document.addEventListener('cart:updated', function(e){
        var detail = e && e.detail ? e.detail : {};
        window.filapen.track('added_to_cart', { cart: detail });
      });
      /* Common product-form intercept */
      document.addEventListener('submit', function(e){
        var f = e.target;
        if (f && f.action && /\\/cart\\/add/.test(f.action)) {
          var id = f.querySelector('[name="id"]'); var qty = f.querySelector('[name="quantity"]');
          window.filapen.track('added_to_cart', {
            variantId: id ? id.value : null,
            quantity: qty ? Number(qty.value || 1) : 1,
            url: location.href,
          });
        }
      }, true);
    } catch(e) {}

    /* Checkout detection */
    try {
      if (/^\\/checkouts?/.test(location.pathname)) {
        window.filapen.track('started_checkout', { url: location.href });
      }
    } catch(e) {}
  } catch(e) { /* never break the host page */ }
})();
`;
}
