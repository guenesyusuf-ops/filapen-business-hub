import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { MarketingEventService } from './marketing-event.service';

/**
 * Shape we expect from a Shopify customer payload (webhook or REST).
 * Only the fields we actually consume are typed.
 */
export interface ShopifyCustomerPayload {
  id: number | string;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  tags?: string | string[] | null;
  accepts_marketing?: boolean | null;
  marketing_opt_in_level?: string | null;
  email_marketing_consent?: {
    state?: string | null;
    opt_in_level?: string | null;
    consent_updated_at?: string | null;
  } | null;
  default_address?: {
    country_code?: string | null;
    city?: string | null;
    province?: string | null;
    zip?: string | null;
  } | null;
  total_spent?: string | number | null;
  orders_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ShopifyCheckoutPayload {
  id: number | string;
  token?: string;
  email?: string | null;
  customer?: ShopifyCustomerPayload | null;
  abandoned_checkout_url?: string | null;
  total_price?: string | null;
  line_items?: any[];
  created_at?: string | null;
  updated_at?: string | null;
}

export interface ShopifyOrderPayload {
  id: number | string;
  email?: string | null;
  customer?: ShopifyCustomerPayload | null;
  total_price?: string | null;
  currency?: string | null;
  line_items?: any[];
  created_at?: string | null;
}

function parseTags(raw: string | string[] | null | undefined): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim()).filter(Boolean);
  return String(raw).split(',').map((t) => t.trim()).filter(Boolean);
}

function deriveConsent(p: ShopifyCustomerPayload): {
  marketingConsent: 'never_subscribed' | 'subscribed' | 'confirmed' | 'unsubscribed';
  consentedAt: Date | null;
} {
  const emc = p.email_marketing_consent;
  if (emc?.state === 'subscribed') {
    const date = emc.consent_updated_at ? new Date(emc.consent_updated_at) : null;
    // opt_in_level 'confirmed_opt_in' means Shopify-side DOI
    if (emc.opt_in_level === 'confirmed_opt_in') {
      return { marketingConsent: 'confirmed', consentedAt: date };
    }
    return { marketingConsent: 'subscribed', consentedAt: date };
  }
  if (emc?.state === 'unsubscribed') {
    return { marketingConsent: 'unsubscribed', consentedAt: null };
  }
  // Fallback: accepts_marketing (older API)
  if (p.accepts_marketing === true) {
    return { marketingConsent: 'subscribed', consentedAt: null };
  }
  if (p.accepts_marketing === false) {
    return { marketingConsent: 'unsubscribed', consentedAt: null };
  }
  return { marketingConsent: 'never_subscribed', consentedAt: null };
}

@Injectable()
export class ContactSyncService {
  private readonly logger = new Logger(ContactSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: MarketingEventService,
  ) {}

  /**
   * Upsert a contact from a Shopify customer payload. Safe to call multiple
   * times (idempotent via unique (orgId, email)).
   */
  async upsertFromShopifyCustomer(
    orgId: string,
    shopId: string | null,
    payload: ShopifyCustomerPayload,
  ): Promise<{ contactId: string | null; created: boolean }> {
    const email = payload.email?.trim().toLowerCase();
    if (!email) {
      this.logger.debug(`Shopify customer ${payload.id} has no email, skipping`);
      return { contactId: null, created: false };
    }

    const consent = deriveConsent(payload);
    const tags = parseTags(payload.tags);
    const addr = payload.default_address;

    const data: Prisma.ContactUpsertArgs['create'] = {
      orgId,
      shopId,
      shopifyCustomerId: String(payload.id),
      email,
      firstName: payload.first_name?.trim() || null,
      lastName: payload.last_name?.trim() || null,
      phone: payload.phone?.trim() || null,
      country: addr?.country_code?.toUpperCase().slice(0, 2) || null,
      city: addr?.city?.trim() || null,
      province: addr?.province?.trim() || null,
      zip: addr?.zip?.trim() || null,
      tags,
      marketingConsent: consent.marketingConsent,
      consentedAt: consent.consentedAt,
      totalSpent: payload.total_spent != null ? new Prisma.Decimal(String(payload.total_spent)) : new Prisma.Decimal(0),
      ordersCount: payload.orders_count ?? 0,
    };

    try {
      const existing = await this.prisma.contact.findUnique({
        where: { orgId_email: { orgId, email } },
      });

      if (existing) {
        // Preserve explicit unsubscribe — Shopify sometimes re-sends old state
        const shouldOverrideConsent =
          existing.marketingConsent !== 'unsubscribed' ||
          consent.marketingConsent === 'unsubscribed';

        await this.prisma.contact.update({
          where: { id: existing.id },
          data: {
            shopId: data.shopId ?? existing.shopId,
            shopifyCustomerId: data.shopifyCustomerId ?? existing.shopifyCustomerId,
            firstName: data.firstName ?? existing.firstName,
            lastName: data.lastName ?? existing.lastName,
            phone: data.phone ?? existing.phone,
            country: data.country ?? existing.country,
            city: data.city ?? existing.city,
            province: data.province ?? existing.province,
            zip: data.zip ?? existing.zip,
            tags: data.tags ?? existing.tags,
            ...(shouldOverrideConsent
              ? {
                  marketingConsent: consent.marketingConsent,
                  consentedAt: consent.consentedAt ?? existing.consentedAt,
                }
              : {}),
            totalSpent: data.totalSpent ?? existing.totalSpent,
            ordersCount: data.ordersCount ?? existing.ordersCount,
          },
        });
        return { contactId: existing.id, created: false };
      }

      const created = await this.prisma.contact.create({ data });
      // Record customer_created event once
      await this.events.record({
        orgId,
        contactId: created.id,
        type: 'customer_created',
        source: 'shopify',
        externalId: `customer:${payload.id}`,
        occurredAt: payload.created_at ? new Date(payload.created_at) : new Date(),
        payload: { email, shopifyCustomerId: payload.id },
      });
      return { contactId: created.id, created: true };
    } catch (err: any) {
      this.logger.error(
        `upsertFromShopifyCustomer failed (org=${orgId}, email=${email}): ${err?.message}`,
        err?.stack,
      );
      return { contactId: null, created: false };
    }
  }

  /**
   * Customer deleted in Shopify → we keep the contact but mark as unsubscribed
   * to stop any further sends. Hard-delete would violate audit trail.
   */
  async handleShopifyCustomerDeleted(orgId: string, shopifyCustomerId: string | number) {
    const contact = await this.prisma.contact.findFirst({
      where: { orgId, shopifyCustomerId: String(shopifyCustomerId) },
    });
    if (!contact) return;
    await this.prisma.contact.update({
      where: { id: contact.id },
      data: {
        marketingConsent: 'unsubscribed',
        unsubscribedAt: new Date(),
      },
    });
    this.events.record({
      orgId,
      contactId: contact.id,
      type: 'customer_deleted',
      source: 'shopify',
      externalId: `customer_deleted:${shopifyCustomerId}`,
    }).catch(() => {});
  }

  /**
   * Handle checkouts/create — Shopify emits this when a checkout starts.
   * Creates (or finds) a contact if an email is present and records a
   * checkout_started event.
   */
  async handleCheckoutStarted(
    orgId: string,
    shopId: string | null,
    payload: ShopifyCheckoutPayload,
  ): Promise<void> {
    const email = (payload.email || payload.customer?.email)?.trim().toLowerCase();
    if (!email) return;

    let contactId: string | null = null;
    if (payload.customer) {
      const up = await this.upsertFromShopifyCustomer(orgId, shopId, payload.customer);
      contactId = up.contactId;
    } else {
      // Minimal contact if we only have email
      const existing = await this.prisma.contact.findUnique({
        where: { orgId_email: { orgId, email } },
      });
      if (existing) contactId = existing.id;
      else {
        const created = await this.prisma.contact.create({
          data: { orgId, shopId, email },
        });
        contactId = created.id;
      }
    }

    await this.events.record({
      orgId,
      contactId,
      type: 'checkout_started',
      source: 'shopify',
      externalId: `checkout:${payload.id}`,
      occurredAt: payload.created_at ? new Date(payload.created_at) : new Date(),
      payload: {
        checkoutId: payload.id,
        token: payload.token,
        totalPrice: payload.total_price,
        itemCount: payload.line_items?.length ?? 0,
        abandonedCheckoutUrl: payload.abandoned_checkout_url,
        lineItems: payload.line_items?.map((li: any) => ({
          productId: li.product_id,
          variantId: li.variant_id,
          title: li.title,
          quantity: li.quantity,
        })),
      },
    });
  }

  /**
   * Handle orders/create — record order_placed event and bump contact stats.
   */
  async handleOrderPlaced(
    orgId: string,
    shopId: string | null,
    payload: ShopifyOrderPayload,
  ): Promise<void> {
    const email = (payload.email || payload.customer?.email)?.trim().toLowerCase();
    if (!email) return;

    let contactId: string | null = null;
    if (payload.customer) {
      const up = await this.upsertFromShopifyCustomer(orgId, shopId, payload.customer);
      contactId = up.contactId;
    } else {
      const existing = await this.prisma.contact.findUnique({
        where: { orgId_email: { orgId, email } },
      });
      if (existing) contactId = existing.id;
      else {
        const created = await this.prisma.contact.create({
          data: { orgId, shopId, email },
        });
        contactId = created.id;
      }
    }

    if (contactId) {
      // Bump aggregated stats (best-effort — full recompute job can fix drift later)
      const total = Number(payload.total_price || 0);
      const now = new Date();
      try {
        const c = await this.prisma.contact.findUnique({ where: { id: contactId } });
        if (c) {
          const newOrdersCount = c.ordersCount + 1;
          const newTotalSpent = new Prisma.Decimal(c.totalSpent).add(total);
          const newAvg = newOrdersCount > 0 ? newTotalSpent.div(newOrdersCount) : new Prisma.Decimal(0);
          await this.prisma.contact.update({
            where: { id: contactId },
            data: {
              ordersCount: newOrdersCount,
              totalSpent: newTotalSpent,
              avgOrderValue: newAvg,
              firstOrderAt: c.firstOrderAt ?? now,
              lastOrderAt: now,
            },
          });
        }
      } catch (err: any) {
        this.logger.warn(`Stats bump failed for contact=${contactId}: ${err?.message}`);
      }
    }

    await this.events.record({
      orgId,
      contactId,
      type: 'order_placed',
      source: 'shopify',
      externalId: `order:${payload.id}`,
      occurredAt: payload.created_at ? new Date(payload.created_at) : new Date(),
      payload: {
        orderId: payload.id,
        totalPrice: payload.total_price,
        currency: payload.currency,
        itemCount: payload.line_items?.length ?? 0,
        lineItems: payload.line_items?.map((li: any) => ({
          productId: li.product_id,
          variantId: li.variant_id,
          title: li.title,
          quantity: li.quantity,
          price: li.price,
        })),
      },
    });
  }

  /**
   * Full recompute of stats from Order table — callable as a maintenance
   * job (e.g. after bulk-import). Uses existing Shopify Order table.
   */
  async recomputeStatsForContact(orgId: string, contactId: string): Promise<void> {
    const contact = await this.prisma.contact.findUnique({ where: { id: contactId } });
    if (!contact?.shopifyCustomerId) return;

    const orders = await this.prisma.order.findMany({
      where: { orgId, customerId: contact.shopifyCustomerId, status: { not: 'cancelled' } },
      select: { totalPrice: true, placedAt: true },
    });
    if (orders.length === 0) return;

    const total = orders.reduce((a, o) => a.add(o.totalPrice), new Prisma.Decimal(0));
    const sorted = orders.map((o) => o.placedAt).sort((a, b) => a.getTime() - b.getTime());
    await this.prisma.contact.update({
      where: { id: contactId },
      data: {
        ordersCount: orders.length,
        totalSpent: total,
        avgOrderValue: total.div(orders.length),
        firstOrderAt: sorted[0],
        lastOrderAt: sorted[sorted.length - 1],
      },
    });
  }
}
