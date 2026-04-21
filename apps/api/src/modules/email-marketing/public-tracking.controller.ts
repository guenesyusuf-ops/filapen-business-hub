import {
  Controller, Get, Post, Body, Query, Headers, Ip, Res, BadRequestException, Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailSettingsService } from './email-settings.service';
import { ContactSyncService } from './contact-sync.service';
import { MarketingEventService } from './marketing-event.service';

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
