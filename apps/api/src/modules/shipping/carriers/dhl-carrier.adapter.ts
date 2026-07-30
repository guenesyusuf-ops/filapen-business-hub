import { Injectable, Logger } from '@nestjs/common';
import { performance } from 'perf_hooks';
import type { CarrierAdapter, CarrierShipmentResult, CarrierTrackingResult, ShipmentCreateInput } from './carrier-adapter.interface';
import { buildLabelHtml } from './label-html-builder';
import { resolveDhlProduct } from './dhl-billing';
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

    // Zentrale Produkt- + Abrechnungsnummer-Aufloesung.
    // Diese Funktion:
    //  - waehlt das Produkt nach dem Verfahren der Nummer (nicht Geografie)
    //  - lehnt AT/CH/etc. als Absender ab (DHL Paket DE kann nur DE-Absender)
    //  - liefert klare Fehler-Codes fuer die verschiedenen Konfigurationsprobleme
    const resolution = resolveDhlProduct({
      originCountry: input.sender.address.country,
      destinationCountry: input.recipient.address.country,
      credentials,
      requestedShippingMethod: input.shippingMethod,
    });
    if (resolution.ok === false) {
      this.logger.warn(`DHL resolve failed [${resolution.errorCode}]: ${resolution.message}`);
      throw new Error(resolution.message);
    }
    const { product, billingNumber, procedure, masked } = resolution;
    const body = this.buildRequestBody(input, billingNumber, product);

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

    // Redigiertes Debug-Log: enthaelt Produkt + maskierte Nummer + Verfahren,
    // damit im Fehlerfall eindeutig nachvollziehbar ist welche Kombination
    // an DHL ging. Keine Secrets, keine vollen EKPs, keine PII.
    this.logger.log(
      `DHL [${mode}] POST ${endpoint} — product=${product} procedure=${procedure} billing=${masked} ` +
      `ref=${input.reference ?? input.orderId} route=${input.sender.address.country || '?'}->${input.recipient.address.country || '?'}`,
    );

    let response: Response | null = null;
    let data: any = {};
    let lastError = '';
    let attemptIndex = 0;
    for (const attempt of authAttempts) {
      attemptIndex++;
      const t0 = performance.now();
      let fetchMs = 0, readMs = 0;
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
        fetchMs = Math.round(performance.now() - t0);
      } catch (err: any) {
        this.logger.error(`DHL fetch failed after ${Math.round(performance.now() - t0)}ms: ${err.message}`);
        throw new Error(`DHL API nicht erreichbar: ${err.message}`);
      }

      const t1 = performance.now();
      const text = await response.text();
      readMs = Math.round(performance.now() - t1);
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

      // Redigiertes Timing-Log fuer diesen Auth-Attempt
      this.logger.log(
        `dhl_call_timing attempt=${attemptIndex}/${authAttempts.length} status=${response.status} ` +
        `fetchMs=${fetchMs} readMs=${readMs} totalMs=${fetchMs + readMs} ok=${response.ok}`,
      );

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
   * pickProduct + pickBillingNumber wurden durch resolveDhlProduct aus
   * ./dhl-billing.ts ersetzt. Die Aufloesung erfolgt jetzt nach Verfahren
   * der Abrechnungsnummer statt nach Geografie.
   */

  private buildRequestBody(input: ShipmentCreateInput, billingNumber: string, product: string) {
    // DHL expects ISO 3166-1 alpha-3 country codes (DEU, FRA, …)
    const shipperCountry = this.iso2to3(input.sender.address.country);
    const consigneeCountry = this.iso2to3(input.recipient.address.country);

    // DHL requires street name and house number in SEPARATE fields.
    // Shopify typically ships "Musterstraße 12" as one line → we must split.
    const shipper = this.splitStreet(input.sender.address.street, input.sender.address.houseNumber, null);
    const consignee = this.splitStreet(
      input.recipient.address.street,
      input.recipient.address.houseNumber,
      input.recipient.address.address2 ?? null,
    );

    return {
      profile: 'STANDARD_GRUPPENPROFIL',
      shipments: [
        {
          product,
          billingNumber,
          refNo: this.buildRefNo(input),
          shipper: {
            name1: (input.sender.name || 'Filapen').slice(0, 50),
            addressStreet: shipper.street.slice(0, 50),
            addressHouse: shipper.house || undefined,
            postalCode: input.sender.address.zip,
            city: input.sender.address.city.slice(0, 40),
            country: shipperCountry,
            email: input.sender.email || undefined,
            phone: input.sender.phone || undefined,
          },
          consignee: {
            name1: (input.recipient.name || 'Empfänger').slice(0, 50),
            addressStreet: consignee.street.slice(0, 50),
            addressHouse: consignee.house || undefined,
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
              // No silent fallback — weight MUST come from the product database
              // (ShippingProductProfile → ProductVariant). OrderShipmentService
              // already throws BadRequest before reaching this point if 0.
              value: Math.max(0.001, input.weightG / 1000),
            },
            ...(input.lengthMm && input.widthMm && input.heightMm
              ? { dim: { uom: 'mm', length: input.lengthMm, width: input.widthMm, height: input.heightMm } }
              : {}),
          },
        },
      ],
    };
  }

  /**
   * DHL requires refNo to be 8–35 characters. Shopify order numbers are often
   * only 4–6 digits (e.g. "1001"), so short references get a "FILAPEN-" prefix
   * to hit the minimum. Longer values are truncated to 35.
   */
  private buildRefNo(input: ShipmentCreateInput): string {
    const raw = (input.reference || input.orderId || '').toString().trim();
    if (raw.length >= 8 && raw.length <= 35) return raw;
    if (raw.length > 35) return raw.slice(0, 35);
    // raw.length < 8 → prefix. "FILAPEN-" alone is 8 chars, plus raw → always ≥ 9.
    return `FILAPEN-${raw}`.slice(0, 35);
  }

  /**
   * Split a street line like "Musterstraße 12a" into { street: "Musterstraße", house: "12a" }.
   * Handles common German formats: "Straße 12", "Straße 12a", "Straße 12/3", "Straße 12-14".
   * If houseNumber is provided separately (e.g. Shopify-Formularfeld), use that instead.
   * If nothing parses cleanly, house="" — DHL rejects with a readable validation error.
   */
  private splitStreet(
    street: string,
    houseNumber: string | undefined,
    address2: string | null,
  ): { street: string; house: string } {
    const s = (street || '').trim();
    const explicitHouse = (houseNumber || '').trim();

    if (explicitHouse) {
      // Remove explicit house number if it's already embedded at the end of the street string
      const escaped = explicitHouse.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cleaned = s.replace(new RegExp(`\\s+${escaped}$`), '').trim();
      return { street: cleaned || s, house: explicitHouse };
    }

    // "Straße 12", "Straße 12a", "Straße 12/3", "Straße 12-14"
    const match = s.match(/^(.+?)\s+(\d+[a-zA-Z]?(?:\s*[\/-]\s*\d+[a-zA-Z]?)?)$/);
    if (match) {
      return { street: match[1].trim(), house: match[2].replace(/\s+/g, '') };
    }

    // Maybe the house number is alone in address2
    if (address2) {
      const m2 = address2.trim().match(/^(\d+[a-zA-Z]?(?:[\/-]\d+[a-zA-Z]?)?)$/);
      if (m2) return { street: s, house: m2[1] };
    }

    return { street: s, house: '' };
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
    // DHL returns detailed validation errors in items[*].validationMessages.
    // Frueher wurden nur die ersten 3 zurueckgegeben — dabei ging die relevante
    // Meldung oft verloren. Jetzt: alle Messages, und wir loggen die volle
    // Response zusaetzlich im Server-Log (redigiert) fuer Debugging.
    if (data?.items?.length) {
      const msgs: string[] = [];
      for (const item of data.items) {
        if (Array.isArray(item.validationMessages)) {
          for (const v of item.validationMessages) {
            msgs.push(`${v.property || 'Feld'}: ${v.validationMessage || 'ungültig'}`);
          }
        }
        if (item.message) msgs.push(item.message);
        if (item.detail) msgs.push(item.detail);
      }
      // Volle Response ins Log (Server-side, nicht User-facing).
      try {
        this.logger.warn(`DHL full validation response (${status}): ${JSON.stringify(data).slice(0, 2000)}`);
      } catch { /* JSON stringify safety */ }
      if (msgs.length) return msgs.join(' | ');
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
