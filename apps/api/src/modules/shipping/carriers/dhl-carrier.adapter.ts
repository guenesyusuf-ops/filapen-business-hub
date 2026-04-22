import { Injectable, Logger } from '@nestjs/common';
import type { CarrierAdapter, CarrierShipmentResult, CarrierTrackingResult, ShipmentCreateInput } from './carrier-adapter.interface';
import { buildLabelHtml } from './label-html-builder';
import * as crypto from 'crypto';

/**
 * DHL Carrier Adapter — Parcel DE Shipping v2 API.
 *
 * Supports two modes:
 *   - "sandbox"    → https://api-sandbox.dhl.com/ (Testing, generates fake labels,
 *                    use DHL-provided test EKP like 33333333330101)
 *   - "production" → https://api-eu.dhl.com/ (real labels, real costs)
 *
 * Credentials are combined from two DHL portals:
 *   - Developer Portal (developer.dhl.com):
 *       apiKey     (Client ID, sent as `dhl-api-key` header)
 *   - Geschäftskundenportal (geschaeftskunden.dhl.de):
 *       billingNumber (EKP-Nr, in request body)
 *       username      (portal login, Basic Auth)
 *       password      (portal login, Basic Auth)
 *
 * If credentials are missing/incomplete → STUB mode (HTML fallback label).
 * API docs: https://developer.dhl.com/api-reference/parcel-germany-post-parcel-api
 */
@Injectable()
export class DhlCarrierAdapter implements CarrierAdapter {
  private readonly logger = new Logger(DhlCarrierAdapter.name);
  readonly key = 'dhl';
  readonly humanName = 'DHL';
  readonly requiresCredentials = true;

  validateCredentials(credentials: any): { ok: boolean; error?: string } {
    if (!credentials) return { ok: false, error: 'Keine Credentials hinterlegt' };
    if (!credentials.apiKey) return { ok: false, error: 'API Key (Client ID vom Developer Portal) fehlt' };
    if (!credentials.billingNumber) return { ok: false, error: 'EKP-Nr (billingNumber) fehlt' };
    // Basic-Auth kann entweder über Geschäftskundenportal-User/Pwd ODER über
    // API-Key/Secret gehen (letzteres für neuere Parcel-DE-Shipping-v2 Setups).
    // Mind. eines der beiden Paare muss vollständig sein.
    const hasUserPwd = !!credentials.username && !!credentials.password;
    const hasApiSecret = !!credentials.apiSecret;
    if (!hasUserPwd && !hasApiSecret) {
      return {
        ok: false,
        error: 'Entweder Username+Passwort (Geschäftskundenportal) ODER API Secret (Developer Portal) erforderlich',
      };
    }
    return { ok: true };
  }

  async createShipment(input: ShipmentCreateInput, credentials: any | null): Promise<CarrierShipmentResult> {
    const validation = credentials ? this.validateCredentials(credentials) : { ok: false };

    if (!validation.ok) {
      this.logger.warn(`DHL in STUB mode — credentials incomplete. Generating local HTML label.`);
      return this.stubLabel(input);
    }

    const mode: 'sandbox' | 'production' = credentials.mode === 'production' ? 'production' : 'sandbox';
    const baseUrl = mode === 'production'
      ? 'https://api-eu.dhl.com'
      : 'https://api-sandbox.dhl.com';
    const endpoint = `${baseUrl}/parcel/de/shipping/v2/orders`;

    const product = this.pickProduct(input);
    const body = this.buildRequestBody(input, credentials.billingNumber, product);

    // Pick Basic-Auth strategy. Prefer user/password (legacy, Geschäftskundenportal).
    // Fallback: API-Key/Secret (new Parcel DE Shipping v2 style for some setups).
    // We'll try one, and if 401, retry with the other automatically — logs will make
    // clear which one finally worked.
    const authAttempts: Array<{ label: string; basic: string }> = [];
    if (credentials.username && credentials.password) {
      authAttempts.push({
        label: `user="${credentials.username}"`,
        basic: Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64'),
      });
    }
    if (credentials.apiSecret) {
      authAttempts.push({
        label: `apiKey+apiSecret`,
        basic: Buffer.from(`${credentials.apiKey}:${credentials.apiSecret}`).toString('base64'),
      });
    }
    if (authAttempts.length === 0) {
      throw new Error('Keine Basic-Auth-Credentials konfiguriert (weder user/pwd noch apiSecret)');
    }

    this.logger.log(`DHL [${mode}] POST ${endpoint} — product=${product}, ref=${input.reference ?? input.orderId}, authAttempts=[${authAttempts.map((a) => a.label).join(', ')}]`);

    let response: Response | null = null;
    let data: any = {};
    let lastError = '';
    for (const attempt of authAttempts) {
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${attempt.basic}`,
            'dhl-api-key': credentials.apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(body),
        });
      } catch (err: any) {
        throw new Error(`DHL API nicht erreichbar: ${err.message}`);
      }

      const text = await response.text();
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

      if (response.ok) {
        this.logger.log(`DHL auth OK via ${attempt.label}`);
        break;
      }

      lastError = this.formatDhlError(response.status, data);
      this.logger.warn(`DHL auth via ${attempt.label} failed: ${response.status} ${lastError}`);

      // Only retry on 401/403 — validation errors are not auth issues.
      if (response.status !== 401 && response.status !== 403) break;
    }

    if (!response || !response.ok) {
      const status = response?.status ?? 0;
      this.logger.error(`DHL API ${status}: ${lastError}`);
      throw new Error(`DHL (${status}): ${lastError}`);
    }

    const item = data?.items?.[0];
    if (!item?.shipmentNo) {
      throw new Error(`DHL-Antwort ohne shipmentNo — Payload: ${JSON.stringify(data).slice(0, 500)}`);
    }

    const labelB64: string | undefined = item.label?.b64;
    const trackingUrl: string | undefined = item.label?.url
      ?? `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${item.shipmentNo}`;

    const costAmount = typeof item.cost?.amount === 'number' ? item.cost.amount
      : typeof item.cost === 'number' ? item.cost
      : null;

    this.logger.log(`DHL [${mode}] OK — shipmentNo=${item.shipmentNo}`);

    return {
      trackingNumber: item.shipmentNo,
      trackingUrl,
      labelFormat: 'pdf_100x150',
      labelPdfBase64: labelB64,
      // HTML fallback only if DHL didn't return a PDF (shouldn't happen, but safety net)
      labelHtml: labelB64 ? undefined : buildLabelHtml(input, {
        carrier: 'DHL',
        trackingNumber: item.shipmentNo,
        format: 'pdf_100x150',
        note: `DHL ${mode} — Label wurde erzeugt, PDF fehlt in Response.`,
      }),
      costCents: costAmount != null ? Math.round(costAmount * 100) : null,
      currency: item.cost?.currency || 'EUR',
    };
  }

  async getTracking(trackingNumber: string, credentials: any | null): Promise<CarrierTrackingResult | null> {
    if (!credentials || !this.validateCredentials(credentials).ok) return null;

    const mode: 'sandbox' | 'production' = credentials.mode === 'production' ? 'production' : 'sandbox';
    const baseUrl = mode === 'production' ? 'https://api-eu.dhl.com' : 'https://api-sandbox.dhl.com';
    const url = `${baseUrl}/parcel/de/tracking/v0/shipments/${encodeURIComponent(trackingNumber)}`;

    try {
      const res = await fetch(url, {
        headers: { 'dhl-api-key': credentials.apiKey, Accept: 'application/json' },
      });
      if (!res.ok) return null;
      const data = await res.json();
      // DHL Tracking API response parsing — minimal for now
      const shipment = data?.shipments?.[0];
      if (!shipment) return null;
      const mappedStatus = this.mapDhlStatus(shipment.status?.statusCode || shipment.status?.status);
      return {
        status: mappedStatus,
        events: (shipment.events || []).map((e: any) => ({
          status: this.mapDhlStatus(e.statusCode || e.status),
          occurredAt: new Date(e.timestamp),
          note: e.description || e.status || null,
          rawData: e,
        })),
      };
    } catch (err: any) {
      this.logger.warn(`DHL tracking fetch failed for ${trackingNumber}: ${err.message}`);
      return null;
    }
  }

  // -----------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------

  private stubLabel(input: ShipmentCreateInput): CarrierShipmentResult {
    const trackingNumber = `STUB${Date.now().toString().slice(-8)}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    return {
      trackingNumber,
      trackingUrl: `https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode=${trackingNumber}`,
      labelFormat: 'pdf_100x150',
      labelHtml: buildLabelHtml(input, {
        carrier: 'DHL',
        trackingNumber,
        format: 'pdf_100x150',
        note: 'Stub-Label (keine DHL-Credentials). Tracking manuell bei DHL anlegen.',
      }),
      costCents: null,
      currency: null,
    };
  }

  /**
   * Auto-pick DHL product based on recipient country.
   * User can override via input.shippingMethod.
   */
  private pickProduct(input: ShipmentCreateInput): string {
    if (input.shippingMethod) return input.shippingMethod;
    const country = (input.recipient.address.country || 'DE').toUpperCase();
    if (country === 'DE') return 'V01PAK'; // DHL Paket National
    const EU_COUNTRIES = ['AT','BE','BG','CY','CZ','DK','EE','ES','FI','FR','GR','HR','HU','IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK'];
    if (EU_COUNTRIES.includes(country)) return 'V54EPAK'; // Europaket
    return 'V53WPAK'; // Weltpaket
  }

  private buildRequestBody(input: ShipmentCreateInput, billingNumber: string, product: string) {
    // DHL expects ISO 3166-1 alpha-3 country codes (DEU, FRA, …)
    const shipperCountry = this.iso2to3(input.sender.address.country);
    const consigneeCountry = this.iso2to3(input.recipient.address.country);

    // Street: DHL expects "addressStreet" (name) + "addressHouse" (number) separately.
    // If house number not split out, DHL accepts the concatenated street as addressStreet.
    const shipperStreet = this.combineStreet(input.sender.address.street, input.sender.address.houseNumber);
    const consigneeStreet = this.combineStreet(input.recipient.address.street, input.recipient.address.houseNumber);

    return {
      profile: 'STANDARD_GRUPPENPROFIL',
      shipments: [
        {
          product,
          billingNumber,
          refNo: (input.reference || input.orderId).slice(0, 35),
          shipper: {
            name1: (input.sender.name || 'Filapen').slice(0, 50),
            addressStreet: shipperStreet.slice(0, 50),
            postalCode: input.sender.address.zip,
            city: input.sender.address.city.slice(0, 40),
            country: shipperCountry,
            email: input.sender.email || undefined,
            phone: input.sender.phone || undefined,
          },
          consignee: {
            name1: (input.recipient.name || 'Empfänger').slice(0, 50),
            addressStreet: consigneeStreet.slice(0, 50),
            addressHouse: undefined, // merged into addressStreet
            additionalAddressInformation1: input.recipient.address.address2 || undefined,
            postalCode: input.recipient.address.zip,
            city: input.recipient.address.city.slice(0, 40),
            country: consigneeCountry,
            email: input.recipient.email || undefined,
            phone: input.recipient.phone || undefined,
          },
          details: {
            weight: {
              uom: 'kg',
              // DHL minimum 1g; anything below is suspicious → default to 1kg
              value: Math.max(0.001, (input.weightG || 1000) / 1000),
            },
            ...(input.lengthMm && input.widthMm && input.heightMm
              ? { dim: { uom: 'mm', length: input.lengthMm, width: input.widthMm, height: input.heightMm } }
              : {}),
          },
        },
      ],
    };
  }

  private combineStreet(street: string, houseNumber?: string): string {
    const s = (street || '').trim();
    const h = (houseNumber || '').trim();
    return h && !s.includes(h) ? `${s} ${h}` : s;
  }

  /**
   * Convert ISO 3166-1 alpha-2 → alpha-3 (DHL requires alpha-3).
   * Subset covers EU + major international destinations; unknown codes pass through.
   */
  private iso2to3(code: string | undefined): string {
    const map: Record<string, string> = {
      DE: 'DEU', AT: 'AUT', CH: 'CHE', FR: 'FRA', BE: 'BEL', NL: 'NLD', LU: 'LUX',
      IT: 'ITA', ES: 'ESP', PT: 'PRT', GB: 'GBR', UK: 'GBR', IE: 'IRL', DK: 'DNK',
      SE: 'SWE', NO: 'NOR', FI: 'FIN', IS: 'ISL', PL: 'POL', CZ: 'CZE', SK: 'SVK',
      HU: 'HUN', SI: 'SVN', HR: 'HRV', RO: 'ROU', BG: 'BGR', GR: 'GRC', CY: 'CYP',
      MT: 'MLT', EE: 'EST', LT: 'LTU', LV: 'LVA', US: 'USA', CA: 'CAN', AU: 'AUS',
      NZ: 'NZL', JP: 'JPN', CN: 'CHN', KR: 'KOR', RU: 'RUS', TR: 'TUR', BR: 'BRA',
      MX: 'MEX', IN: 'IND', ZA: 'ZAF', LI: 'LIE', MC: 'MCO', SM: 'SMR', VA: 'VAT',
    };
    const c = (code || 'DE').toUpperCase();
    return map[c] || (c.length === 3 ? c : 'DEU');
  }

  private formatDhlError(status: number, data: any): string {
    // DHL returns detailed validation errors in items[*].validationMessages
    if (data?.items?.length) {
      const msgs: string[] = [];
      for (const item of data.items) {
        if (Array.isArray(item.validationMessages)) {
          for (const v of item.validationMessages) {
            msgs.push(`${v.property || 'Feld'}: ${v.validationMessage || 'ungültig'}`);
          }
        }
        if (item.message) msgs.push(item.message);
      }
      if (msgs.length) return msgs.slice(0, 3).join(' | ');
    }
    return data?.detail || data?.title || data?.message || data?.raw || `HTTP ${status}`;
  }

  private mapDhlStatus(code: string | undefined): CarrierTrackingResult['status'] {
    // DHL uses German-language codes internally — cover the common ones
    const s = (code || '').toLowerCase();
    if (s.includes('deliver') || s.includes('zugestellt')) return 'delivered';
    if (s.includes('transit') || s.includes('unterwegs')) return 'in_transit';
    if (s.includes('out_for_delivery') || s.includes('zustellung')) return 'out_for_delivery';
    if (s.includes('pickup') || s.includes('abhol')) return 'ready_for_pickup';
    if (s.includes('return') || s.includes('retour')) return 'returned';
    if (s.includes('fail') || s.includes('nicht zustellbar')) return 'delivery_failed';
    if (s.includes('exception') || s.includes('fehler')) return 'exception';
    return 'in_transit';
  }
}
